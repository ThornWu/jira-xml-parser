const { Stream } = require('stream');

// 导入常量和工具函数
const {
  buffers,
  SAX_EVENTS,
  SAX_ENTITIES,
  XML_ENTITIES,
  CDATA,
  DOCTYPE,
  nameStart,
  nameBody,
  entityStart,
  entityBody,
  STATE
} = require('./constants');

const {
  isWhitespace,
  isQuote,
  isAttribEnd,
  isMatch,
  notMatch,
  emit,
  closeText,
  emitNode,
  parseEntity,
  beginWhiteSpace,
  charAt,
  newTag
} = require('./utils');


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
          if (!isWhitespace(c) && (!parser.sawRoot || parser.closedRoot)) {
          }
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
          if (parser.doctype || parser.sawRoot) {
          }
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
            if (!isWhitespace(c)) {
            }
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
        } else {
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
        } else {
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
        } else {
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
          if (!isWhitespace(c)) {
          }
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

;(function (sax) { // wrapper for non-node envs
  sax.parser = function (strict, opt) { return new SAXParser(strict, opt) }
  sax.SAXStream = SAXStream
  sax.createStream = createStream

  function SAXParser (strict, opt) {
    if (!(this instanceof SAXParser)) {
      return new SAXParser(strict, opt)
    }

    var parser = this
    clearBuffers(parser)
    parser.q = parser.c = ''
    parser.opt = opt || {}
    parser.tags = []
    parser.closed = parser.closedRoot = parser.sawRoot = false
    parser.tag = parser.error = null
    parser.noscript = !!parser.opt.noscript
    parser.state = STATE.BEGIN
    parser.attribList = []

    emit(parser, 'onready')
  }

  SAXParser.prototype = {
    end: function () { end(this) },
    write: write,
    resume: function () { this.error = null; return this },
    close: function () { return this.write(null) },
    flush: function () { flushBuffers(this) }
  }

  var streamWraps = SAX_EVENTS.filter(function (ev) {
    return ev !== 'error' && ev !== 'end'
  })

  function createStream (strict, opt) {
    return new SAXStream(strict, opt)
  }

  function SAXStream (strict, opt) {
    if (!(this instanceof SAXStream)) {
      return new SAXStream(strict, opt)
    }

    Stream.apply(this)

    this._parser = new SAXParser(strict, opt)
    this.writable = true
    this.readable = true

    var me = this

    this._parser.onend = function () {
      me.emit('end')
    }

    this._parser.onerror = function (er) {
      me.emit('error', er)

      // if didn't throw, then means error was handled.
      // go ahead and clear error, so we can write again.
      me._parser.error = null
    }

    this._parser.clearBuffers = function () {
      clearBuffers(me._parser)
    }

    this._decoder = null

    streamWraps.forEach(function (ev) {
      Object.defineProperty(me, 'on' + ev, {
        get: function () {
          return me._parser['on' + ev]
        },
        set: function (h) {
          if (!h) {
            me.removeAllListeners(ev)
            me._parser['on' + ev] = h
            return h
          }
          me.on(ev, h)
        },
        enumerable: true,
        configurable: false
      })
    })
  }

  SAXStream.prototype = Object.create(Stream.prototype, {
    constructor: {
      value: SAXStream
    }
  })

  SAXStream.prototype.write = function (data) {
    if (typeof Buffer === 'function' &&
      typeof Buffer.isBuffer === 'function' &&
      Buffer.isBuffer(data)) {
      if (!this._decoder) {
        var SD = require('string_decoder').StringDecoder
        this._decoder = new SD('utf8')
      }
      data = this._decoder.write(data)
    }

    this._parser.write(data.toString())
    this.emit('data', data)
    return true
  }

  SAXStream.prototype.end = function (chunk) {
    if (chunk && chunk.length) {
      this.write(chunk)
    }
    this._parser.end()
    return true
  }

  SAXStream.prototype.on = function (ev, handler) {
    var me = this
    if (!me._parser['on' + ev] && streamWraps.indexOf(ev) !== -1) {
      me._parser['on' + ev] = function () {
        var args = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments)
        args.splice(0, 0, ev)
        me.emit.apply(me, args)
      }
    }

    return Stream.prototype.on.call(me, ev, handler)
  }

  Object.keys(SAX_ENTITIES).forEach(function (key) {
    var e = SAX_ENTITIES[key]
    var s = typeof e === 'number' ? String.fromCharCode(e) : e
    SAX_ENTITIES[key] = s
  })

  function end (parser) {
    if ((parser.state !== STATE.BEGIN) &&
      (parser.state !== STATE.BEGIN_WHITESPACE) &&
      (parser.state !== STATE.TEXT)) {
      error(parser, 'Unexpected end')
    }
    closeText(parser)
    parser.c = ''
    parser.closed = true
    emit(parser, 'onend')
    SAXParser.call(parser, parser.strict, parser.opt)
    return parser
  }
})(typeof exports === 'undefined' ? this.sax = {} : exports)
