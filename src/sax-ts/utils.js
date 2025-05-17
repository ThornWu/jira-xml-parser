/**
 * SAX解析器使用的工具函数
 */
const { STATE, SAX_ENTITIES } = require('./constants');

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

module.exports = {
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
}
