// 缓冲区名称列表 - 保持固定顺序以优化直接索引访问
const buffers = [
  'textNode', 'tagName', 'comment', 'sgmlDecl', 'doctype',
  'procInstName', 'procInstBody', 'entity', 'attribName',
  'attribValue', 'cdata', 'script'
]

// SAX事件类型列表
const SAX_EVENTS = [
  'text',
  'processinginstruction',
  'sgmldeclaration',
  'doctype',
  'comment',
  'opentagstart',
  'attribute',
  'opentag',
  'closetag',
  'opencdata',
  'cdata',
  'closecdata',
  'error',
  'end',
  'ready',
  'script',
  'opennamespace',
  'closenamespace'
]

// XML实体映射表
const SAX_ENTITIES = {
  'amp': '&',
  'gt': '>',
  'lt': '<',
  'quot': '"',
  'apos': "'",
  'AElig': 198,
  'Aacute': 193,
  'Acirc': 194,
  'Agrave': 192,
  'Aring': 197,
  'Atilde': 195,
  'Auml': 196,
  'Ccedil': 199,
  'ETH': 208,
  'Eacute': 201,
  'Ecirc': 202,
  'Egrave': 200,
  'Euml': 203,
  'Iacute': 205,
  'Icirc': 206,
  'Igrave': 204,
  'Iuml': 207,
  'Ntilde': 209,
  'Oacute': 211,
  'Ocirc': 212,
  'Ograve': 210,
  'Oslash': 216,
  'Otilde': 213,
  'Ouml': 214,
  'THORN': 222,
  'Uacute': 218,
  'Ucirc': 219,
  'Ugrave': 217,
  'Uuml': 220,
  'Yacute': 221,
  'aacute': 225,
  'acirc': 226,
  'aelig': 230,
  'agrave': 224,
  'aring': 229,
  'atilde': 227,
  'auml': 228,
  'ccedil': 231,
  'eacute': 233,
  'ecirc': 234,
  'egrave': 232,
  'eth': 240,
  'euml': 235,
  'iacute': 237,
  'icirc': 238,
  'igrave': 236,
  'iuml': 239,
  'ntilde': 241,
  'oacute': 243,
  'ocirc': 244,
  'ograve': 242,
  'oslash': 248,
  'otilde': 245,
  'ouml': 246,
  'szlig': 223,
  'thorn': 254,
  'uacute': 250,
  'ucirc': 251,
  'ugrave': 249,
  'uuml': 252,
  'yacute': 253,
  'yuml': 255,
  'copy': 169,
  'reg': 174,
  'nbsp': 160,
  'iexcl': 161,
  'cent': 162,
  'pound': 163,
  'curren': 164,
  'yen': 165,
  'brvbar': 166,
  'sect': 167,
  'uml': 168,
  'ordf': 170,
  'laquo': 171,
  'not': 172,
  'shy': 173,
  'macr': 175,
  'deg': 176,
  'plusmn': 177,
  'sup1': 185,
  'sup2': 178,
  'sup3': 179,
  'acute': 180,
  'micro': 181,
  'para': 182,
  'middot': 183,
  'cedil': 184,
  'ordm': 186,
  'raquo': 187,
  'frac14': 188,
  'frac12': 189,
  'frac34': 190,
  'iquest': 191,
  'times': 215,
  'divide': 247,
  'OElig': 338,
  'oelig': 339,
  'Scaron': 352,
  'scaron': 353,
  'Yuml': 376,
  'fnof': 402,
  'circ': 710,
  'tilde': 732,
  'Alpha': 913,
  'Beta': 914,
  'Gamma': 915,
  'Delta': 916,
  'Epsilon': 917,
  'Zeta': 918,
  'Eta': 919,
  'Theta': 920,
  'Iota': 921,
  'Kappa': 922,
  'Lambda': 923,
  'Mu': 924,
  'Nu': 925,
  'Xi': 926,
  'Omicron': 927,
  'Pi': 928,
  'Rho': 929,
  'Sigma': 931,
  'Tau': 932,
  'Upsilon': 933,
  'Phi': 934,
  'Chi': 935,
  'Psi': 936,
  'Omega': 937,
  'alpha': 945,
  'beta': 946,
  'gamma': 947,
  'delta': 948,
  'epsilon': 949,
  'zeta': 950,
  'eta': 951,
  'theta': 952,
  'iota': 953,
  'kappa': 954,
  'lambda': 955,
  'mu': 956,
  'nu': 957,
  'xi': 958,
  'omicron': 959,
  'pi': 960,
  'rho': 961,
  'sigmaf': 962,
  'sigma': 963,
  'tau': 964,
  'upsilon': 965,
  'phi': 966,
  'chi': 967,
  'psi': 968,
  'omega': 969,
  'thetasym': 977,
  'upsih': 978,
  'piv': 982,
  'ensp': 8194,
  'emsp': 8195,
  'thinsp': 8201,
  'zwnj': 8204,
  'zwj': 8205,
  'lrm': 8206,
  'rlm': 8207,
  'ndash': 8211,
  'mdash': 8212,
  'lsquo': 8216,
  'rsquo': 8217,
  'sbquo': 8218,
  'ldquo': 8220,
  'rdquo': 8221,
  'bdquo': 8222,
  'dagger': 8224,
  'Dagger': 8225,
  'bull': 8226,
  'hellip': 8230,
  'permil': 8240,
  'prime': 8242,
  'Prime': 8243,
  'lsaquo': 8249,
  'rsaquo': 8250,
  'oline': 8254,
  'frasl': 8260,
  'euro': 8364,
  'image': 8465,
  'weierp': 8472,
  'real': 8476,
  'trade': 8482,
  'alefsym': 8501,
  'larr': 8592,
  'uarr': 8593,
  'rarr': 8594,
  'darr': 8595,
  'harr': 8596,
  'crarr': 8629,
  'lArr': 8656,
  'uArr': 8657,
  'rArr': 8658,
  'dArr': 8659,
  'hArr': 8660,
  'forall': 8704,
  'part': 8706,
  'exist': 8707,
  'empty': 8709,
  'nabla': 8711,
  'isin': 8712,
  'notin': 8713,
  'ni': 8715,
  'prod': 8719,
  'sum': 8721,
  'minus': 8722,
  'lowast': 8727,
  'radic': 8730,
  'prop': 8733,
  'infin': 8734,
  'ang': 8736,
  'and': 8743,
  'or': 8744,
  'cap': 8745,
  'cup': 8746,
  'int': 8747,
  'there4': 8756,
  'sim': 8764,
  'cong': 8773,
  'asymp': 8776,
  'ne': 8800,
  'equiv': 8801,
  'le': 8804,
  'ge': 8805,
  'sub': 8834,
  'sup': 8835,
  'nsub': 8836,
  'sube': 8838,
  'supe': 8839,
  'oplus': 8853,
  'otimes': 8855,
  'perp': 8869,
  'sdot': 8901,
  'lceil': 8968,
  'rceil': 8969,
  'lfloor': 8970,
  'rfloor': 8971,
  'lang': 9001,
  'rang': 9002,
  'loz': 9674,
  'spades': 9824,
  'clubs': 9827,
  'hearts': 9829,
  'diams': 9830
}

// XML实体映射表
const XML_ENTITIES = {
  'amp': '&',
  'gt': '>',
  'lt': '<',
  'quot': '"',
  'apos': "'"
}

// 特殊标记
const CDATA = '[CDATA['
const DOCTYPE = 'DOCTYPE'

// 正则表达式
const nameStart = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/

const nameBody = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/

const entityStart = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/
const entityBody = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/

// 解析器状态常量
const STATE = {
  BEGIN: 0, // leading byte order mark or whitespace
  BEGIN_WHITESPACE: 1, // leading whitespace
  TEXT: 2, // general stuff
  TEXT_ENTITY: 3, // &amp and such.
  OPEN_WAKA: 4, // <
  SGML_DECL: 5, // <!BLARG
  SGML_DECL_QUOTED: 6, // <!BLARG foo "bar
  DOCTYPE: 7, // <!DOCTYPE
  DOCTYPE_QUOTED: 8, // <!DOCTYPE "//blah
  DOCTYPE_DTD: 9, // <!DOCTYPE "//blah" [ ...
  DOCTYPE_DTD_QUOTED: 10, // <!DOCTYPE "//blah" [ "foo
  COMMENT_STARTING: 11, // <!-
  COMMENT: 12, // <!--
  COMMENT_ENDING: 13, // <!-- blah -
  COMMENT_ENDED: 14, // <!-- blah --
  CDATA: 15, // <![CDATA[ something
  CDATA_ENDING: 16, // ]
  CDATA_ENDING_2: 17, // ]]
  PROC_INST: 18, // <?hi
  PROC_INST_BODY: 19, // <?hi there
  PROC_INST_ENDING: 20, // <?hi "there" ?
  OPEN_TAG: 21, // <strong
  OPEN_TAG_SLASH: 22, // <strong /
  ATTRIB: 23, // <a
  ATTRIB_NAME: 24, // <a foo
  ATTRIB_NAME_SAW_WHITE: 25, // <a foo _
  ATTRIB_VALUE: 26, // <a foo=
  ATTRIB_VALUE_QUOTED: 27, // <a foo="bar
  ATTRIB_VALUE_CLOSED: 28, // <a foo="bar"
  ATTRIB_VALUE_UNQUOTED: 29, // <a foo=bar
  ATTRIB_VALUE_ENTITY_Q: 30, // <foo bar="&quot;"
  ATTRIB_VALUE_ENTITY_U: 31, // <foo bar=&quot
  CLOSE_TAG: 32, // </a
  CLOSE_TAG_SAW_WHITE: 33, // </a   >
  SCRIPT: 34, // <script> ...
  SCRIPT_ENDING: 35 // <script> ... <
}

// 将对象转换为Map以提高查找效率
const SAX_ENTITIES_MAP = new Map(Object.entries(SAX_ENTITIES));
const XML_ENTITIES_MAP = new Map(Object.entries(XML_ENTITIES));

module.exports = {
  buffers,
  SAX_EVENTS,
  SAX_ENTITIES,
  SAX_ENTITIES_MAP,
  XML_ENTITIES,
  XML_ENTITIES_MAP,
  CDATA,
  DOCTYPE,
  nameStart,
  nameBody,
  entityStart,
  entityBody,
  STATE
}
