const { STATE, SAX_ENTITIES_MAP } = require('./constants');

const whitespaces = new Set([' ', '\n', '\r', '\t']);
const isWhitespace = c => whitespaces.has(c);

const quotes = new Set(['"', '\'']);
const isQuote = c => quotes.has(c);

const isAttribEnd = c => c === '>' || isWhitespace(c);
const isMatch = (regex, c) => regex.test(c);

const emit = (parser, event, data) => {
  const handler = parser[event];
  if (handler) handler(data);
};

const closeText = parser => {
  if (parser.textNode) emit(parser, 'ontext', parser.textNode);
  parser.textNode = '';
};


const emitNode = (parser, nodeType, data) => {
  if (parser.textNode) closeText(parser);
  emit(parser, nodeType, data);
};

const parseEntity = parser => {
  let entity = parser.entity;
  const entityLC = entity.toLowerCase();

  // 使用 Map 加速查找
  let result = SAX_ENTITIES_MAP.get(entity) || SAX_ENTITIES_MAP.get(entityLC);
  if (result) return result;

  entity = entityLC

  // Handle numeric entities
  if (entity.charAt(0) === '#') {
    const isHex = entity.charAt(1) === 'x';
    const numText = entity.slice(isHex ? 2 : 1);
    const base = isHex ? 16 : 10;
    const num = parseInt(numText, base);

    // Validate the parsed number
    if (!isNaN(num) && num.toString(base).toLowerCase() === numText.replace(/^0+/, '')) {
      return String.fromCodePoint(num);
    }
  }

  return `&${parser.entity};`;
}

const beginWhiteSpace = (parser, c) => {
  if (c === '<') {
    parser.state = STATE.OPEN_WAKA;
    parser.startTagPosition = parser.position;
  } else if (!isWhitespace(c)) {
    parser.textNode = c;
    parser.state = STATE.TEXT;
  }
};

const charAt = (chunk, i) => i < chunk.length ? chunk[i] : '';

const newTag = parser => {
  const tag = parser.tag = { name: parser.tagName, attributes: {} };
  parser.attribList.length = 0;
  emitNode(parser, 'onopentagstart', tag);
};

const attrib = parser => {
  if (parser.attribList.includes(parser.attribName) ||
      parser.tag.attributes.hasOwnProperty(parser.attribName)) {
    parser.attribName = parser.attribValue = '';
    return;
  }

  // Set attribute and emit event in one go
  parser.tag.attributes[parser.attribName] = parser.attribValue;
  emitNode(parser, 'onattribute', {
    name: parser.attribName,
    value: parser.attribValue
  });

  parser.attribName = parser.attribValue = '';
};

const openTag = (parser, selfClosing) => {
  parser.tag.isSelfClosing = !!selfClosing;

  // Process the tag
  parser.sawRoot = true;
  parser.tags.push(parser.tag);
  emitNode(parser, 'onopentag', parser.tag);

  if (!selfClosing) {
    // Special case for <script> in non-strict mode
    parser.state = (!parser.noscript && parser.tagName.toLowerCase() === 'script')
      ? STATE.SCRIPT
      : STATE.TEXT;
    parser.tag = null;
    parser.tagName = '';
  }

  parser.attribName = parser.attribValue = '';
  parser.attribList.length = 0;
};

const closeTag = parser => {
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

  // Check if closing tag exists in our stack
  let t = parser.tags.length
  const tagName = parser.tagName
  const closeTo = tagName

  // Find matching tag
  while (t-- && parser.tags[t].name !== closeTo) {}

  // Tag not found
  if (t < 0) {
    parser.textNode += '</' + parser.tagName + '>'
    parser.state = STATE.TEXT
    return
  }

  // Close all tags until the matching one
  let s = parser.tags.length
  while (s-- > t) {
    parser.tag = parser.tags.pop()
    parser.tagName = parser.tag.name
    emitNode(parser, 'onclosetag', parser.tagName)
  }

  if (t === 0) parser.closedRoot = true
  parser.tagName = parser.attribValue = parser.attribName = ''
  parser.attribList.length = 0
  parser.state = STATE.TEXT
}

const error = (parser, er) => {
  closeText(parser)
  er = new Error(er)
  parser.error = er
  emit(parser, 'onerror', er)
  return parser
}


module.exports = {
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
}
