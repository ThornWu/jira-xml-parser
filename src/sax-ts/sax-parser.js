const {
  SAX_ENTITIES,
  SAX_ENTITIES_MAP,
  STATE,
  XML_ENTITIES_MAP,
  CDATA,
  DOCTYPE,
  nameStart,
  nameBody,
  entityStart,
  entityBody,
  buffers
} = require('./constants');

const {
  emit,
  closeText,
  error,
  isWhitespace,
  isQuote,
  isAttribEnd,
  isMatch,
  emitNode,
  parseEntity,
  beginWhiteSpace,
  charAt,
  newTag,
  attrib,
  openTag,
  closeTag
} = require('./utils');

// 主要功能定义
class SAXParser {
  constructor() {
    if (!(this instanceof SAXParser)) {
      return new SAXParser()
    }

    this._clearBuffers()
    this.q = this.c = ''
    this.tags = []
    this.closed = this.closedRoot = this.sawRoot = false
    this.tag = this.error = null
    this.noscript = false
    this.state = STATE.BEGIN
    this.attribList = []

    this.xmlEntityValuesSet = new Set(XML_ENTITIES_MAP.values());

    emit(this, 'onready')
  }

  clearBuffers() {
    this._clearBuffers();
  }

  _clearBuffers() {
    const len = buffers.length
    for (let i = 0; i < len; i++) {
      this[buffers[i]] = ''
    }
  }

  end() {
    return this._end()
  }

  write(data) {
    return this._write(data)
  }

  _write(chunk) {
    if (this.error) {
      throw this.error
    }
    if (this.closed) {
      return error(this,
        'Cannot write after close. Assign an onready handler.')
    }
    if (chunk === null) {
      return this._end()
    }
    if (typeof chunk === 'object') {
      chunk = chunk.toString()
    }
    var i = 0
    var c = ''
    while (true) {
      c = charAt(chunk, i++)
      this.c = c

      if (!c) {
        break
      }

      switch (this.state) {
        case STATE.BEGIN:
          this.state = STATE.BEGIN_WHITESPACE
          if (c === '\uFEFF') {
            continue
          }
          beginWhiteSpace(this, c)
          continue

        case STATE.BEGIN_WHITESPACE:
          beginWhiteSpace(this, c)
          continue

        case STATE.TEXT:
          if (this.sawRoot && !this.closedRoot) {
            var starti = i - 1
            while (c && c !== '<' && c !== '&') {
              c = charAt(chunk, i++)
            }
            this.textNode += chunk.substring(starti, i - 1)
          }
          if (c === '<' && !(this.sawRoot && this.closedRoot && !this.strict)) {
            this.state = STATE.OPEN_WAKA
            this.startTagPosition = this.position
          } else {
            if (c === '&') {
              this.state = STATE.TEXT_ENTITY
            } else {
              this.textNode += c
            }
          }
          continue

        case STATE.SCRIPT:
          // only non-strict
          if (c === '<') {
            this.state = STATE.SCRIPT_ENDING
          } else {
            this.script += c
          }
          continue

        case STATE.SCRIPT_ENDING:
          if (c === '/') {
            this.state = STATE.CLOSE_TAG
          } else {
            this.script += '<' + c
            this.state = STATE.SCRIPT
          }
          continue

        case STATE.OPEN_WAKA:
          // either a /, ?, !, or text is coming next.
          if (c === '!') {
            this.state = STATE.SGML_DECL
            this.sgmlDecl = ''
          } else if (isWhitespace(c)) {
            // wait for it...
          } else if (isMatch(nameStart, c)) {
            this.state = STATE.OPEN_TAG
            this.tagName = c
          } else if (c === '/') {
            this.state = STATE.CLOSE_TAG
            this.tagName = ''
          } else if (c === '?') {
            this.state = STATE.PROC_INST
            this.procInstName = this.procInstBody = ''
          } else {
            // if there was some whitespace, then add that in.
            if (this.startTagPosition + 1 < this.position) {
              var pad = this.position - this.startTagPosition
              c = Array.from({ length: pad }).join(' ') + c
            }
            this.textNode += '<' + c
            this.state = STATE.TEXT
          }
          continue

        case STATE.SGML_DECL:
          if (this.sgmlDecl + c === '--') {
            this.state = STATE.COMMENT
            this.comment = ''
            this.sgmlDecl = ''
            continue;
          }

          if (this.doctype && this.doctype !== true && this.sgmlDecl) {
            this.state = STATE.DOCTYPE_DTD
            this.doctype += '<!' + this.sgmlDecl + c
            this.sgmlDecl = ''
          } else if ((this.sgmlDecl + c).toUpperCase() === CDATA) {
            emitNode(this, 'onopencdata')
            this.state = STATE.CDATA
            this.sgmlDecl = ''
            this.cdata = ''
          } else if ((this.sgmlDecl + c).toUpperCase() === DOCTYPE) {
            this.state = STATE.DOCTYPE
            this.doctype = ''
            this.sgmlDecl = ''
          } else if (c === '>') {
            emitNode(this, 'onsgmldeclaration', this.sgmlDecl)
            this.sgmlDecl = ''
            this.state = STATE.TEXT
          } else if (isQuote(c)) {
            this.state = STATE.SGML_DECL_QUOTED
            this.sgmlDecl += c
          } else {
            this.sgmlDecl += c
          }
          continue

        case STATE.SGML_DECL_QUOTED:
          if (c === this.q) {
            this.state = STATE.SGML_DECL
            this.q = ''
          }
          this.sgmlDecl += c
          continue

        case STATE.DOCTYPE:
          if (c === '>') {
            this.state = STATE.TEXT
            emitNode(this, 'ondoctype', this.doctype)
            this.doctype = true // just remember that we saw it.
          } else {
            this.doctype += c
            if (c === '[') {
              this.state = STATE.DOCTYPE_DTD
            } else if (isQuote(c)) {
              this.state = STATE.DOCTYPE_QUOTED
              this.q = c
            }
          }
          continue

        case STATE.DOCTYPE_QUOTED:
          this.doctype += c
          if (c === this.q) {
            this.q = ''
            this.state = STATE.DOCTYPE
          }
          continue

        case STATE.DOCTYPE_DTD:
          if (c === ']') {
            this.doctype += c
            this.state = STATE.DOCTYPE
          } else if (c === '<') {
            this.state = STATE.OPEN_WAKA
            this.startTagPosition = this.position
          } else if (isQuote(c)) {
            this.doctype += c
            this.state = STATE.DOCTYPE_DTD_QUOTED
            this.q = c
          } else {
            this.doctype += c
          }
          continue

        case STATE.DOCTYPE_DTD_QUOTED:
          this.doctype += c
          if (c === this.q) {
            this.state = STATE.DOCTYPE_DTD
            this.q = ''
          }
          continue

        case STATE.COMMENT:
          if (c === '-') {
            this.state = STATE.COMMENT_ENDING
          } else {
            this.comment += c
          }
          continue

        case STATE.COMMENT_ENDING:
          if (c === '-') {
            this.state = STATE.COMMENT_ENDED
            if (this.comment) {
              emitNode(this, 'oncomment', this.comment)
            }
            this.comment = ''
          } else {
            this.comment += '-' + c
            this.state = STATE.COMMENT
          }
          continue

        case STATE.COMMENT_ENDED:
          if (c !== '>') {
            // allow <!-- blah -- bloo --> in non-strict mode,
            // which is a comment of " blah -- bloo "
            this.comment += '--' + c
            this.state = STATE.COMMENT
          } else if (this.doctype && this.doctype !== true) {
            this.state = STATE.DOCTYPE_DTD
          } else {
            this.state = STATE.TEXT
          }
          continue

        case STATE.CDATA:
          if (c === ']') {
            this.state = STATE.CDATA_ENDING
          } else {
            this.cdata += c
          }
          continue

        case STATE.CDATA_ENDING:
          if (c === ']') {
            this.state = STATE.CDATA_ENDING_2
          } else {
            this.cdata += ']' + c
            this.state = STATE.CDATA
          }
          continue

        case STATE.CDATA_ENDING_2:
          if (c === '>') {
            if (this.cdata) {
              emitNode(this, 'oncdata', this.cdata)
            }
            emitNode(this, 'onclosecdata')
            this.cdata = ''
            this.state = STATE.TEXT
          } else if (c === ']') {
            this.cdata += ']'
          } else {
            this.cdata += ']]' + c
            this.state = STATE.CDATA
          }
          continue

        case STATE.PROC_INST:
          if (c === '?') {
            this.state = STATE.PROC_INST_ENDING
          } else if (isWhitespace(c)) {
            this.state = STATE.PROC_INST_BODY
          } else {
            this.procInstName += c
          }
          continue

        case STATE.PROC_INST_BODY:
          if (!this.procInstBody && isWhitespace(c)) {
            continue
          } else if (c === '?') {
            this.state = STATE.PROC_INST_ENDING
          } else {
            this.procInstBody += c
          }
          continue

        case STATE.PROC_INST_ENDING:
          if (c === '>') {
            emitNode(this, 'onprocessinginstruction', {
              name: this.procInstName,
              body: this.procInstBody
            })
            this.procInstName = this.procInstBody = ''
            this.state = STATE.TEXT
          } else {
            this.procInstBody += '?' + c
            this.state = STATE.PROC_INST_BODY
          }
          continue

        case STATE.OPEN_TAG:
          if (isMatch(nameBody, c)) {
            this.tagName += c
          } else {
            newTag(this)
            if (c === '>') {
              openTag(this)
            } else if (c === '/') {
              this.state = STATE.OPEN_TAG_SLASH
            } else {
              this.state = STATE.ATTRIB
            }
          }
          continue

        case STATE.OPEN_TAG_SLASH:
          if (c === '>') {
            openTag(this, true)
            closeTag(this)
          } else {
            this.state = STATE.ATTRIB
          }
          continue

        case STATE.ATTRIB:
          // haven't read the attribute name yet.
          if (isWhitespace(c)) {
            continue
          } else if (c === '>') {
            openTag(this)
          } else if (c === '/') {
            this.state = STATE.OPEN_TAG_SLASH
          } else if (isMatch(nameStart, c)) {
            this.attribName = c
            this.attribValue = ''
            this.state = STATE.ATTRIB_NAME
          }
          continue

        case STATE.ATTRIB_NAME:
          if (c === '=') {
            this.state = STATE.ATTRIB_VALUE
          } else if (c === '>') {
            this.attribValue = this.attribName
            attrib(this)
            openTag(this)
          } else if (isWhitespace(c)) {
            this.state = STATE.ATTRIB_NAME_SAW_WHITE
          } else if (isMatch(nameBody, c)) {
            this.attribName += c
          }
          continue

        case STATE.ATTRIB_NAME_SAW_WHITE:
          if (c === '=') {
            this.state = STATE.ATTRIB_VALUE
          } else if (isWhitespace(c)) {
            continue
          } else {
            this.tag.attributes[this.attribName] = ''
            this.attribValue = ''
            emitNode(this, 'onattribute', {
              name: this.attribName,
              value: ''
            })
            this.attribName = ''
            if (c === '>') {
              openTag(this)
            } else if (isMatch(nameStart, c)) {
              this.attribName = c
              this.state = STATE.ATTRIB_NAME
            } else {
              this.state = STATE.ATTRIB
            }
          }
          continue

        case STATE.ATTRIB_VALUE:
          if (isWhitespace(c)) {
            continue
          } else if (isQuote(c)) {
            this.q = c
            this.state = STATE.ATTRIB_VALUE_QUOTED
          } else {
            this.state = STATE.ATTRIB_VALUE_UNQUOTED
            this.attribValue = c
          }
          continue

        case STATE.ATTRIB_VALUE_QUOTED:
          if (c !== this.q) {
            if (c === '&') {
              this.state = STATE.ATTRIB_VALUE_ENTITY_Q
            } else {
              this.attribValue += c
            }
            continue
          }
          attrib(this)
          this.q = ''
          this.state = STATE.ATTRIB_VALUE_CLOSED
          continue

        case STATE.ATTRIB_VALUE_CLOSED:
          if (isWhitespace(c)) {
            this.state = STATE.ATTRIB
          } else if (c === '>') {
            openTag(this)
          } else if (c === '/') {
            this.state = STATE.OPEN_TAG_SLASH
          } else if (isMatch(nameStart, c)) {
            this.attribName = c
            this.attribValue = ''
            this.state = STATE.ATTRIB_NAME
          }
          continue

        case STATE.ATTRIB_VALUE_UNQUOTED:
          if (!isAttribEnd(c)) {
            if (c === '&') {
              this.state = STATE.ATTRIB_VALUE_ENTITY_U
            } else {
              this.attribValue += c
            }
            continue
          }
          attrib(this)
          if (c === '>') {
            openTag(this)
          } else {
            this.state = STATE.ATTRIB
          }
          continue

        case STATE.CLOSE_TAG:
          if (!this.tagName) {
            if (isWhitespace(c)) {
              continue
            } else if (!isMatch(nameStart, c)) {
              if (this.script) {
                this.script += '</' + c
                this.state = STATE.SCRIPT
              } else {
              }
            } else {
              this.tagName = c
            }
          } else if (c === '>') {
            closeTag(this)
          } else if (isMatch(nameBody, c)) {
            this.tagName += c
          } else if (this.script) {
            this.script += '</' + this.tagName
            this.tagName = ''
            this.state = STATE.SCRIPT
          } else {
            this.state = STATE.CLOSE_TAG_SAW_WHITE
          }
          continue

        case STATE.CLOSE_TAG_SAW_WHITE:
          if (isWhitespace(c)) {
            continue
          }
          if (c === '>') {
            closeTag(this)
          } else {
          }
          continue

        case STATE.TEXT_ENTITY:
        case STATE.ATTRIB_VALUE_ENTITY_Q:
        case STATE.ATTRIB_VALUE_ENTITY_U:
          var returnState
          var buffer
          switch (this.state) {
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
            var parsedEntity = parseEntity(this)
            if (!this.xmlEntityValuesSet.has(parsedEntity)) {
              this.entity = ''
              this.state = returnState
              this.write(parsedEntity)
            } else {
              this[buffer] += parsedEntity
              this.entity = ''
              this.state = returnState
            }
          } else if (isMatch(this.entity.length ? entityBody : entityStart, c)) {
            this.entity += c
          } else {
            this[buffer] += '&' + this.entity + c
            this.entity = ''
            this.state = returnState
          }

          continue

        default: /* istanbul ignore next */ {
          throw new Error(this, 'Unknown state: ' + this.state)
        }
      }
    } // while

    return this
  }

  resume() {
    this.error = null;
    return this
  }

  close() {
    return this.write(null)
  }

  flush() {
    this._flushBuffers()
  }

  _flushBuffers() {
    closeText(this)
    if (this.cdata !== '') {
      emitNode(this, 'oncdata', this.cdata)
      this.cdata = ''
    }
    if (this.script !== '') {
      emitNode(this, 'onscript', this.script)
      this.script = ''
    }
  }

  _end() {
    if ((this.state !== STATE.BEGIN) &&
      (this.state !== STATE.BEGIN_WHITESPACE) &&
      (this.state !== STATE.TEXT)) {
      error(this, 'Unexpected end')
    }
    closeText(this)
    this.c = ''
    this.closed = true
    emit(this, 'onend')

    // 重置解析器状态
    this._clearBuffers()
    this.q = this.c = ''
    this.tags = []
    this.closed = this.closedRoot = this.sawRoot = false
    this.tag = this.error = null
    this.noscript = false
    this.state = STATE.BEGIN
    this.attribList = []

    return this
  }
}

// 处理实体字符 - 预处理数值型实体到字符串
// 只在初始化时执行一次，而不是每次解析时都处理
Object.keys(SAX_ENTITIES).forEach(function (key) {
  var e = SAX_ENTITIES[key]
  var s = typeof e === 'number' ? String.fromCharCode(e) : e
  SAX_ENTITIES[key] = s
  // 同时更新 Map
  SAX_ENTITIES_MAP.set(key, s)
})

module.exports = SAXParser;
