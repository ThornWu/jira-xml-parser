/**
 * SAX解析器使用的工具函数
 */
const { STATE, SAX_ENTITIES,   buffers,
  XML_ENTITIES,
  CDATA,
  DOCTYPE,
  nameStart,
  nameBody,
  entityStart,
  entityBody } = require('./constants');

/**
 * 检查字符是否为空白字符
 * @param c 要检查的字符
 * @returns 如果是空白字符返回true，否则返回false
 */
function isWhitespace(c) {
  return c === ' ' || c === '\n' || c === '\r' || c === '\t'
}

/**
 * 检查字符是否为引号
 * @param c 要检查的字符
 * @returns 如果是引号返回true，否则返回false
 */
function isQuote(c) {
  return c === '"' || c === '\''
}

/**
 * 检查字符是否为属性结束符
 * @param c 要检查的字符
 * @returns 如果是属性结束符返回true，否则返回false
 */
function isAttribEnd(c) {
  return c === '>' || isWhitespace(c)
}

/**
 * 检查字符是否匹配正则表达式
 * @param regex 正则表达式
 * @param c 要检查的字符
 * @returns 如果匹配返回true，否则返回false
 */
function isMatch(regex, c) {
  return regex.test(c)
}

/**
 * 检查字符是否不匹配正则表达式
 * @param regex 正则表达式
 * @param c 要检查的字符
 * @returns 如果不匹配返回true，否则返回false
 */
function notMatch(regex, c) {
  return !isMatch(regex, c)
}

/**
 * 触发解析器事件
 * @param parser 解析器对象
 * @param event 事件名称
 * @param data 事件数据
 */
function emit(parser, event, data) {
  parser[event] && parser[event](data)
}

/**
 * 关闭文本节点并触发文本事件
 * @param parser 解析器对象
 */
function closeText(parser) {
  if (parser.textNode) emit(parser, 'ontext', parser.textNode)
  parser.textNode = ''
}

/**
 * 触发节点事件
 * @param parser 解析器对象
 * @param nodeType 节点类型
 * @param data 节点数据
 */
function emitNode(parser, nodeType, data) {
  if (parser.textNode) closeText(parser)
  emit(parser, nodeType, data)
}

/**
 * 解析实体
 * @param parser 解析器对象
 * @returns 解析后的实体字符串
 */
function parseEntity(parser) {
  var entity = parser.entity
  var entityLC = entity.toLowerCase()
  var num
  var numStr = ''

  if (SAX_ENTITIES[entity]) {
    return SAX_ENTITIES[entity]
  }
  if (SAX_ENTITIES[entityLC]) {
    return SAX_ENTITIES[entityLC]
  }
  entity = entityLC
  if (entity.charAt(0) === '#') {
    if (entity.charAt(1) === 'x') {
      entity = entity.slice(2)
      num = parseInt(entity, 16)
      numStr = num.toString(16)
    } else {
      entity = entity.slice(1)
      num = parseInt(entity, 10)
      numStr = num.toString(10)
    }
  }
  entity = entity.replace(/^0+/, '')
  if (isNaN(num) || numStr.toLowerCase() !== entity) {
    return '&' + parser.entity + ';'
  }

  return String.fromCodePoint(num)
}

/**
 * 处理开始的空白字符
 * @param parser 解析器对象
 * @param c 当前字符
 */
function beginWhiteSpace(parser, c) {
  if (c === '<') {
    parser.state = STATE.OPEN_WAKA
    parser.startTagPosition = parser.position
  } else if (!isWhitespace(c)) {
    // have to process this as a text node.
    // weird, but happens.
    parser.textNode = c
    parser.state = STATE.TEXT
  }
}

/**
 * 获取字符串中指定位置的字符
 * @param chunk 字符串
 * @param i 位置索引
 * @returns 指定位置的字符
 */
function charAt(chunk, i) {
  var result = ''
  if (i < chunk.length) {
    result = chunk.charAt(i)
  }
  return result
}

/**
 * 创建新标签
 * @param parser 解析器对象
 */
function newTag(parser) {
  var tag = parser.tag = { name: parser.tagName, attributes: {} }
  parser.attribList.length = 0
  emitNode(parser, 'onopentagstart', tag)
}

function attrib (parser) {
  if (parser.attribList.indexOf(parser.attribName) !== -1 ||
    parser.tag.attributes.hasOwnProperty(parser.attribName)) {
    parser.attribName = parser.attribValue = ''
    return
  }

  // in non-xmlns mode, we can emit the event right away
  parser.tag.attributes[parser.attribName] = parser.attribValue
  emitNode(parser, 'onattribute', {
    name: parser.attribName,
    value: parser.attribValue
  })

  parser.attribName = parser.attribValue = ''
}

function openTag (parser, selfClosing) {
  parser.tag.isSelfClosing = !!selfClosing

  // process the tag
  parser.sawRoot = true
  parser.tags.push(parser.tag)
  emitNode(parser, 'onopentag', parser.tag)
  if (!selfClosing) {
    // special case for <script> in non-strict mode.
    if (!parser.noscript && parser.tagName.toLowerCase() === 'script') {
      parser.state = STATE.SCRIPT
    } else {
      parser.state = STATE.TEXT
    }
    parser.tag = null
    parser.tagName = ''
  }
  parser.attribName = parser.attribValue = ''
  parser.attribList.length = 0
}

function closeTag (parser) {
  if (!parser.tagName) {
    parser.textNode += '</>'
    parser.state = STATE.TEXT
    return
  }

  if (parser.script) {
    if (parser.tagName !== 'script') {
      parser.script += '</' + parser.tagName + '>'
      parser.tagName = ''
      parser.state = STATE.SCRIPT
      return
    }
    emitNode(parser, 'onscript', parser.script)
    parser.script = ''
  }

  // first make sure that the closing tag actually exists.
  // <a><b></c></b></a> will close everything, otherwise.
  var t = parser.tags.length
  var tagName = parser.tagName
  var closeTo = tagName
  while (t--) {
    var close = parser.tags[t]
    if (close.name !== closeTo) {
      // fail the first time in strict mode
    } else {
      break
    }
  }

  // didn't find it.  we already failed for strict, so just abort.
  if (t < 0) {
    parser.textNode += '</' + parser.tagName + '>'
    parser.state = STATE.TEXT
    return
  }
  parser.tagName = tagName
  var s = parser.tags.length
  while (s-- > t) {
    var tag = parser.tag = parser.tags.pop()
    parser.tagName = parser.tag.name
    emitNode(parser, 'onclosetag', parser.tagName)

    var x = {}
    for (var i in tag.ns) {
      x[i] = tag.ns[i]
    }
  }
  if (t === 0) parser.closedRoot = true
  parser.tagName = parser.attribValue = parser.attribName = ''
  parser.attribList.length = 0
  parser.state = STATE.TEXT
}

function write (chunk) {
  var parser = this
  if (this.error) {
    throw this.error
  }
  if (parser.closed) {
    return error(parser,
      'Cannot write after close. Assign an onready handler.')
  }
  if (chunk === null) {
    return end(parser)
  }
  if (typeof chunk === 'object') {
    chunk = chunk.toString()
  }
  var i = 0
  var c = ''
  while (true) {
    c = charAt(chunk, i++)
    parser.c = c

    if (!c) {
      break
    }

    switch (parser.state) {
      case STATE.BEGIN:
        parser.state = STATE.BEGIN_WHITESPACE
        if (c === '\uFEFF') {
          continue
        }
        beginWhiteSpace(parser, c)
        continue

      case STATE.BEGIN_WHITESPACE:
        beginWhiteSpace(parser, c)
        continue

      case STATE.TEXT:
        if (parser.sawRoot && !parser.closedRoot) {
          var starti = i - 1
          while (c && c !== '<' && c !== '&') {
            c = charAt(chunk, i++)
          }
          parser.textNode += chunk.substring(starti, i - 1)
        }
        if (c === '<' && !(parser.sawRoot && parser.closedRoot && !parser.strict)) {
          parser.state = STATE.OPEN_WAKA
          parser.startTagPosition = parser.position
        } else {
          if (c === '&') {
            parser.state = STATE.TEXT_ENTITY
          } else {
            parser.textNode += c
          }
        }
        continue

      case STATE.SCRIPT:
        // only non-strict
        if (c === '<') {
          parser.state = STATE.SCRIPT_ENDING
        } else {
          parser.script += c
        }
        continue

      case STATE.SCRIPT_ENDING:
        if (c === '/') {
          parser.state = STATE.CLOSE_TAG
        } else {
          parser.script += '<' + c
          parser.state = STATE.SCRIPT
        }
        continue

      case STATE.OPEN_WAKA:
        // either a /, ?, !, or text is coming next.
        if (c === '!') {
          parser.state = STATE.SGML_DECL
          parser.sgmlDecl = ''
        } else if (isWhitespace(c)) {
          // wait for it...
        } else if (isMatch(nameStart, c)) {
          parser.state = STATE.OPEN_TAG
          parser.tagName = c
        } else if (c === '/') {
          parser.state = STATE.CLOSE_TAG
          parser.tagName = ''
        } else if (c === '?') {
          parser.state = STATE.PROC_INST
          parser.procInstName = parser.procInstBody = ''
        } else {
          // if there was some whitespace, then add that in.
          if (parser.startTagPosition + 1 < parser.position) {
            var pad = parser.position - parser.startTagPosition
            c = new Array(pad).join(' ') + c
          }
          parser.textNode += '<' + c
          parser.state = STATE.TEXT
        }
        continue

      case STATE.SGML_DECL:
        if (parser.sgmlDecl + c === '--') {
          parser.state = STATE.COMMENT
          parser.comment = ''
          parser.sgmlDecl = ''
          continue;
        }

        if (parser.doctype && parser.doctype !== true && parser.sgmlDecl) {
          parser.state = STATE.DOCTYPE_DTD
          parser.doctype += '<!' + parser.sgmlDecl + c
          parser.sgmlDecl = ''
        } else if ((parser.sgmlDecl + c).toUpperCase() === CDATA) {
          emitNode(parser, 'onopencdata')
          parser.state = STATE.CDATA
          parser.sgmlDecl = ''
          parser.cdata = ''
        } else if ((parser.sgmlDecl + c).toUpperCase() === DOCTYPE) {
          parser.state = STATE.DOCTYPE
          parser.doctype = ''
          parser.sgmlDecl = ''
        } else if (c === '>') {
          emitNode(parser, 'onsgmldeclaration', parser.sgmlDecl)
          parser.sgmlDecl = ''
          parser.state = STATE.TEXT
        } else if (isQuote(c)) {
          parser.state = STATE.SGML_DECL_QUOTED
          parser.sgmlDecl += c
        } else {
          parser.sgmlDecl += c
        }
        continue

      case STATE.SGML_DECL_QUOTED:
        if (c === parser.q) {
          parser.state = STATE.SGML_DECL
          parser.q = ''
        }
        parser.sgmlDecl += c
        continue

      case STATE.DOCTYPE:
        if (c === '>') {
          parser.state = STATE.TEXT
          emitNode(parser, 'ondoctype', parser.doctype)
          parser.doctype = true // just remember that we saw it.
        } else {
          parser.doctype += c
          if (c === '[') {
            parser.state = STATE.DOCTYPE_DTD
          } else if (isQuote(c)) {
            parser.state = STATE.DOCTYPE_QUOTED
            parser.q = c
          }
        }
        continue

      case STATE.DOCTYPE_QUOTED:
        parser.doctype += c
        if (c === parser.q) {
          parser.q = ''
          parser.state = STATE.DOCTYPE
        }
        continue

      case STATE.DOCTYPE_DTD:
        if (c === ']') {
          parser.doctype += c
          parser.state = STATE.DOCTYPE
        } else if (c === '<') {
          parser.state = STATE.OPEN_WAKA
          parser.startTagPosition = parser.position
        } else if (isQuote(c)) {
          parser.doctype += c
          parser.state = STATE.DOCTYPE_DTD_QUOTED
          parser.q = c
        } else {
          parser.doctype += c
        }
        continue

      case STATE.DOCTYPE_DTD_QUOTED:
        parser.doctype += c
        if (c === parser.q) {
          parser.state = STATE.DOCTYPE_DTD
          parser.q = ''
        }
        continue

      case STATE.COMMENT:
        if (c === '-') {
          parser.state = STATE.COMMENT_ENDING
        } else {
          parser.comment += c
        }
        continue

      case STATE.COMMENT_ENDING:
        if (c === '-') {
          parser.state = STATE.COMMENT_ENDED
          if (parser.comment) {
            emitNode(parser, 'oncomment', parser.comment)
          }
          parser.comment = ''
        } else {
          parser.comment += '-' + c
          parser.state = STATE.COMMENT
        }
        continue

      case STATE.COMMENT_ENDED:
        if (c !== '>') {
          // allow <!-- blah -- bloo --> in non-strict mode,
          // which is a comment of " blah -- bloo "
          parser.comment += '--' + c
          parser.state = STATE.COMMENT
        } else if (parser.doctype && parser.doctype !== true) {
          parser.state = STATE.DOCTYPE_DTD
        } else {
          parser.state = STATE.TEXT
        }
        continue

      case STATE.CDATA:
        if (c === ']') {
          parser.state = STATE.CDATA_ENDING
        } else {
          parser.cdata += c
        }
        continue

      case STATE.CDATA_ENDING:
        if (c === ']') {
          parser.state = STATE.CDATA_ENDING_2
        } else {
          parser.cdata += ']' + c
          parser.state = STATE.CDATA
        }
        continue

      case STATE.CDATA_ENDING_2:
        if (c === '>') {
          if (parser.cdata) {
            emitNode(parser, 'oncdata', parser.cdata)
          }
          emitNode(parser, 'onclosecdata')
          parser.cdata = ''
          parser.state = STATE.TEXT
        } else if (c === ']') {
          parser.cdata += ']'
        } else {
          parser.cdata += ']]' + c
          parser.state = STATE.CDATA
        }
        continue

      case STATE.PROC_INST:
        if (c === '?') {
          parser.state = STATE.PROC_INST_ENDING
        } else if (isWhitespace(c)) {
          parser.state = STATE.PROC_INST_BODY
        } else {
          parser.procInstName += c
        }
        continue

      case STATE.PROC_INST_BODY:
        if (!parser.procInstBody && isWhitespace(c)) {
          continue
        } else if (c === '?') {
          parser.state = STATE.PROC_INST_ENDING
        } else {
          parser.procInstBody += c
        }
        continue

      case STATE.PROC_INST_ENDING:
        if (c === '>') {
          emitNode(parser, 'onprocessinginstruction', {
            name: parser.procInstName,
            body: parser.procInstBody
          })
          parser.procInstName = parser.procInstBody = ''
          parser.state = STATE.TEXT
        } else {
          parser.procInstBody += '?' + c
          parser.state = STATE.PROC_INST_BODY
        }
        continue

      case STATE.OPEN_TAG:
        if (isMatch(nameBody, c)) {
          parser.tagName += c
        } else {
          newTag(parser)
          if (c === '>') {
            openTag(parser)
          } else if (c === '/') {
            parser.state = STATE.OPEN_TAG_SLASH
          } else {
            parser.state = STATE.ATTRIB
          }
        }
        continue

      case STATE.OPEN_TAG_SLASH:
        if (c === '>') {
          openTag(parser, true)
          closeTag(parser)
        } else {
          parser.state = STATE.ATTRIB
        }
        continue

      case STATE.ATTRIB:
        // haven't read the attribute name yet.
        if (isWhitespace(c)) {
          continue
        } else if (c === '>') {
          openTag(parser)
        } else if (c === '/') {
          parser.state = STATE.OPEN_TAG_SLASH
        } else if (isMatch(nameStart, c)) {
          parser.attribName = c
          parser.attribValue = ''
          parser.state = STATE.ATTRIB_NAME
        }
        continue

      case STATE.ATTRIB_NAME:
        if (c === '=') {
          parser.state = STATE.ATTRIB_VALUE
        } else if (c === '>') {
          parser.attribValue = parser.attribName
          attrib(parser)
          openTag(parser)
        } else if (isWhitespace(c)) {
          parser.state = STATE.ATTRIB_NAME_SAW_WHITE
        } else if (isMatch(nameBody, c)) {
          parser.attribName += c
        }
        continue

      case STATE.ATTRIB_NAME_SAW_WHITE:
        if (c === '=') {
          parser.state = STATE.ATTRIB_VALUE
        } else if (isWhitespace(c)) {
          continue
        } else {
          parser.tag.attributes[parser.attribName] = ''
          parser.attribValue = ''
          emitNode(parser, 'onattribute', {
            name: parser.attribName,
            value: ''
          })
          parser.attribName = ''
          if (c === '>') {
            openTag(parser)
          } else if (isMatch(nameStart, c)) {
            parser.attribName = c
            parser.state = STATE.ATTRIB_NAME
          } else {
            parser.state = STATE.ATTRIB
          }
        }
        continue

      case STATE.ATTRIB_VALUE:
        if (isWhitespace(c)) {
          continue
        } else if (isQuote(c)) {
          parser.q = c
          parser.state = STATE.ATTRIB_VALUE_QUOTED
        } else {
          parser.state = STATE.ATTRIB_VALUE_UNQUOTED
          parser.attribValue = c
        }
        continue

      case STATE.ATTRIB_VALUE_QUOTED:
        if (c !== parser.q) {
          if (c === '&') {
            parser.state = STATE.ATTRIB_VALUE_ENTITY_Q
          } else {
            parser.attribValue += c
          }
          continue
        }
        attrib(parser)
        parser.q = ''
        parser.state = STATE.ATTRIB_VALUE_CLOSED
        continue

      case STATE.ATTRIB_VALUE_CLOSED:
        if (isWhitespace(c)) {
          parser.state = STATE.ATTRIB
        } else if (c === '>') {
          openTag(parser)
        } else if (c === '/') {
          parser.state = STATE.OPEN_TAG_SLASH
        } else if (isMatch(nameStart, c)) {
          parser.attribName = c
          parser.attribValue = ''
          parser.state = STATE.ATTRIB_NAME
        }
        continue

      case STATE.ATTRIB_VALUE_UNQUOTED:
        if (!isAttribEnd(c)) {
          if (c === '&') {
            parser.state = STATE.ATTRIB_VALUE_ENTITY_U
          } else {
            parser.attribValue += c
          }
          continue
        }
        attrib(parser)
        if (c === '>') {
          openTag(parser)
        } else {
          parser.state = STATE.ATTRIB
        }
        continue

      case STATE.CLOSE_TAG:
        if (!parser.tagName) {
          if (isWhitespace(c)) {
            continue
          } else if (notMatch(nameStart, c)) {
            if (parser.script) {
              parser.script += '</' + c
              parser.state = STATE.SCRIPT
            } else {
            }
          } else {
            parser.tagName = c
          }
        } else if (c === '>') {
          closeTag(parser)
        } else if (isMatch(nameBody, c)) {
          parser.tagName += c
        } else if (parser.script) {
          parser.script += '</' + parser.tagName
          parser.tagName = ''
          parser.state = STATE.SCRIPT
        } else {
          parser.state = STATE.CLOSE_TAG_SAW_WHITE
        }
        continue

      case STATE.CLOSE_TAG_SAW_WHITE:
        if (isWhitespace(c)) {
          continue
        }
        if (c === '>') {
          closeTag(parser)
        } else {
        }
        continue

      case STATE.TEXT_ENTITY:
      case STATE.ATTRIB_VALUE_ENTITY_Q:
      case STATE.ATTRIB_VALUE_ENTITY_U:
        var returnState
        var buffer
        switch (parser.state) {
          case STATE.TEXT_ENTITY:
            returnState = STATE.TEXT
            buffer = 'textNode'
            break

          case STATE.ATTRIB_VALUE_ENTITY_Q:
            returnState = STATE.ATTRIB_VALUE_QUOTED
            buffer = 'attribValue'
            break

          case STATE.ATTRIB_VALUE_ENTITY_U:
            returnState = STATE.ATTRIB_VALUE_UNQUOTED
            buffer = 'attribValue'
            break
        }

        if (c === ';') {
          var parsedEntity = parseEntity(parser)
          if (!Object.values(XML_ENTITIES).includes(parsedEntity)) {
            parser.entity = ''
            parser.state = returnState
            parser.write(parsedEntity)
          } else {
            parser[buffer] += parsedEntity
            parser.entity = ''
            parser.state = returnState
          }
        } else if (isMatch(parser.entity.length ? entityBody : entityStart, c)) {
          parser.entity += c
        } else {
          parser[buffer] += '&' + parser.entity + c
          parser.entity = ''
          parser.state = returnState
        }

        continue

      default: /* istanbul ignore next */ {
        throw new Error(parser, 'Unknown state: ' + parser.state)
      }
    }
  } // while

  return parser
}

function clearBuffers (parser) {
  console.log('sax---clearBuffers');
  for (var i = 0, l = buffers.length; i < l; i++) {
    parser[buffers[i]] = ''
  }
}

function flushBuffers (parser) {
  closeText(parser)
  if (parser.cdata !== '') {
    emitNode(parser, 'oncdata', parser.cdata)
    parser.cdata = ''
  }
  if (parser.script !== '') {
    emitNode(parser, 'onscript', parser.script)
    parser.script = ''
  }
}

function error (parser, er) {
  closeText(parser)
  er = new Error(er)
  parser.error = er
  emit(parser, 'onerror', er)
  return parser
}


module.exports = {
  emit,
  closeText,
  clearBuffers,
  flushBuffers,
  error,
  write
}
