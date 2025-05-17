const { Stream } = require('stream');
const { StringDecoder } = require('string_decoder');
const SAXParser = require('./sax-parser');
const { SAX_EVENTS } = require('./constants');

// 缓存过滤后的事件数组和 Set 集合，避免每次重新创建
const streamWraps = SAX_EVENTS.filter(ev => ev !== 'error' && ev !== 'end');
const streamWrapsSet = new Set(streamWraps);

class SAXStream extends Stream {
  constructor() {
    super();

    this._parser = new SAXParser();
    this._decoder = null;

    // 使用箭头函数避免 this 绑定问题
    this._parser.onend = () => this.emit('end');

    this._parser.onerror = (er) => {
      this.emit('error', er);
      // 清除错误，以便能够继续写入
      this._parser.error = null;
    };

    // 批量定义事件属性，提高性能
    this._setupEventProperties();
  }

  _setupEventProperties() {
    // 一次性设置所有事件处理器属性
    streamWraps.forEach(ev => {
      Object.defineProperty(this, 'on' + ev, {
        get: () => this._parser['on' + ev],
        set: (h) => {
          if (!h) {
            this.removeAllListeners(ev);
            this._parser['on' + ev] = h;
            return h;
          }
          this.on(ev, h);
        },
        enumerable: true,
        configurable: false
      });
    });
  }

  write(data) {
    // 优化 Buffer 检测，减少函数调用
    if (Buffer.isBuffer(data)) {
      if (!this._decoder) {
        this._decoder = new StringDecoder('utf8');
      }
      data = this._decoder.write(data);
    } else if (typeof data !== 'string') {
      // 直接转换非字符串类型，避免额外的 toString() 调用
      data = String(data);
    }

    this._parser.write(data);
    this.emit('data', data);
    return true;
  }

  end(chunk) {
    if (chunk && chunk.length) {
      this.write(chunk);
    }
    this._parser.end();
    return true;
  }

  on(ev, handler) {
    // 优化事件分发
    if (streamWrapsSet.has(ev) && !this._parser['on' + ev]) {
      this._parser['on' + ev] = (...args) => {
        this.emit(ev, ...args);
      };
    }

    return Stream.prototype.on.call(this, ev, handler);
  }
}

module.exports = { SAXStream };
