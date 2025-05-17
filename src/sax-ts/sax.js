const { Stream } = require('stream');
const SD = require('string_decoder').StringDecoder

// 导入常量和工具函数
const {
  SAX_EVENTS,
  SAX_ENTITIES,
  STATE
} = require('./constants');

const {
  emit,
  closeText,
  clearBuffers,
  flushBuffers,
  error,
  write
} = require('./utils');


// 主要功能定义
class SAXParser {
  constructor() {
    if (!(this instanceof SAXParser)) {
      return new SAXParser()
    }

    clearBuffers(this)
    this.q = this.c = ''
    this.tags = []
    this.closed = this.closedRoot = this.sawRoot = false
    this.tag = this.error = null
    this.noscript = false
    this.state = STATE.BEGIN
    this.attribList = []

    emit(this, 'onready')
  }

  end() {
    return end(this)
  }

  write(data) {
    return write.call(this, data)
  }

  resume() {
    this.error = null;
    return this
  }

  close() {
    return this.write(null)
  }

  flush() {
    flushBuffers(this)
  }
}

var streamWraps = SAX_EVENTS.filter(function (ev) {
  return ev !== 'error' && ev !== 'end'
})

class SAXStream extends Stream {
  constructor() {
    super()

    if (!(this instanceof SAXStream)) {
      return new SAXStream()
    }

    this._parser = new SAXParser()
    this.writable = true
    this.readable = true

    const me = this

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

  write(data) {
    if (typeof Buffer === 'function' &&
      typeof Buffer.isBuffer === 'function' &&
      Buffer.isBuffer(data)) {
      if (!this._decoder) {
        this._decoder = new SD('utf8')
      }
      data = this._decoder.write(data)
    }

    this._parser.write(data.toString())
    this.emit('data', data)
    return true
  }

  end(chunk) {
    if (chunk && chunk.length) {
      this.write(chunk)
    }
    this._parser.end()
    return true
  }

  on(ev, handler) {
    const me = this
    if (!me._parser['on' + ev] && streamWraps.indexOf(ev) !== -1) {
      me._parser['on' + ev] = function () {
        const args = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments)
        args.splice(0, 0, ev)
        me.emit.apply(me, args)
      }
    }

    return Stream.prototype.on.call(me, ev, handler)
  }
}

// 处理实体字符
Object.keys(SAX_ENTITIES).forEach(function (key) {
  var e = SAX_ENTITIES[key]
  var s = typeof e === 'number' ? String.fromCharCode(e) : e
  SAX_ENTITIES[key] = s
})

// 结束解析处理器
function end(parser) {
  if ((parser.state !== STATE.BEGIN) &&
    (parser.state !== STATE.BEGIN_WHITESPACE) &&
    (parser.state !== STATE.TEXT)) {
    error(parser, 'Unexpected end')
  }
  closeText(parser)
  parser.c = ''
  parser.closed = true
  emit(parser, 'onend')

  // 重置解析器状态
  clearBuffers(parser)
  parser.q = parser.c = ''
  parser.tags = []
  parser.closed = parser.closedRoot = parser.sawRoot = false
  parser.tag = parser.error = null
  parser.noscript = false
  parser.state = STATE.BEGIN
  parser.attribList = []

  return parser
}

// 导出模块
module.exports = {
  parser: function() { return new SAXParser() },
  SAXStream: SAXStream
};
