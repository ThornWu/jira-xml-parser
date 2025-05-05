import * as sax from 'sax';
import { createReadStream, type ReadStream } from 'fs';
import { EventEmitter } from 'events';

const cloneDeep = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
}
export interface BigXmlReaderOptions {
  /** 一级过滤，过滤 xml 标签名 */
  entityPattern: RegExp;
  /** 是否为 EntityFile */
  isEntityFile?: boolean;
}

export interface XmlNode {
  _tag: string;
  [key: string]: any;
}

class BigXmlReader extends EventEmitter {
  private parser: sax.SAXStream;
  private stream: ReadStream;
  private node: Partial<XmlNode>;
  private nodes: Partial<XmlNode>[];

  private level: number;
  private isEntityFile: boolean;

  constructor(filename: string, options: BigXmlReaderOptions) {
    super();

    this.parser = sax.createStream(false, { trim: false });
    this.stream = createReadStream(filename);
    this.node = {};
    this.nodes = [];
    this.level = 0;
    this.isEntityFile = options.isEntityFile || false;

    this.setupParserHandlers(options.entityPattern);
    this.stream.pipe(this.parser);
  }

  private setupParserHandlers(entityPattern: RegExp): void {
    this.parser.on('error', (err: Error) => {
      this.emit('error', new Error(err.message));
    });

    this.stream.on('error', (err: Error) => {
      this.emit('error', new Error(err.message));
    });

    this.parser.on('opentag', (_node: sax.Tag) => {
      this.level++;
      const name = _node.name;
      const attrs = _node.attributes;
      const child: XmlNode = { _tag: name, ...attrs, _level: this.level };

      if (this.level === this.node._level) {
        this.node = this.nodes[this.nodes.length - 1];
      }

      // 第 1 层不作为第 0 层的 children
      if (this.level > 1) {
        // entity 文件不记录根节点下的 children，否则按需没有意义
        if (!this.isEntityFile || !(this.level <= 2)) {
          if (!this.node.children) {
            this.node.children = [];
          }
          this.node.children.push(child);
        }
      }

      this.node = child;
      this.nodes.push(child);
    });

    this.parser.on('cdata', (txt: string) => {
      if (txt?.length > 0) {
        if (this.node.text === undefined) {
          this.node.text = txt;
        } else {
          this.node.text += txt;
        }
      }
    })

    this.parser.on('closetag', (name: string) => {
      this.level--;
      this.node = this.nodes.pop() || {};

      if (name.match(entityPattern)) {
        if (this.isEntityFile) {
          let record = cloneDeep(this.node);
          const children = record.children || [];
          record = {...record,...children.reduce((acc: Record<string, XmlNode>, child: XmlNode) => {
            acc[child._tag] = child.text;
            return acc;
          }, {} as Record<string, XmlNode>) };
          delete (record as any)?.children;
          this.emit('record', record);
        } else {
          this.emit('record', this.node);
        }
      }

      if (this.level === 0) {
        this.emit('end');
      }
    });

    // this.parser.on('text', (txt: string) => {
    //   if (txt.length > 0) {
    //     if (this.node.text === undefined) {
    //       this.node.text = txt;
    //     } else {
    //       this.node.text += txt;
    //     }
    //   }
    // });
  }

  public pause(): void {
    this.stream.pause();
  }

  public resume(): void {
    this.stream.resume();
  }
}

export function createReader(filename: string, options: BigXmlReaderOptions): BigXmlReader {
  return new BigXmlReader(filename, options);
}
