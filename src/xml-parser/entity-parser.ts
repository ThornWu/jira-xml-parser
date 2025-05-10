import * as sax from 'sax';
import { createReadStream, type ReadStream } from 'fs';
import { EventEmitter } from 'events';
export interface EntityReaderOptions {
  /** 一级过滤，过滤 xml 标签名 */
  entityPattern: RegExp;
  /** 最后一个实体名，用于提前跳出 */
  lastEntity: string;
}

export interface XmlNode {
  _tag: string;
  _level?: number;
  text?: string;
  children?: XmlNode[];
  [key: string]: any;
}

export class EntityParser extends EventEmitter {
  private parser: sax.SAXStream;
  private stream: ReadStream;
  private node: Partial<XmlNode>;
  private nodes: Partial<XmlNode>[];
  private level: number;
  private isSkip: boolean;
  private lastEntity: string;

  constructor(filename: string, options: EntityReaderOptions) {
    super();

    this.parser = sax.createStream(false, { trim: false });
    this.stream = createReadStream(filename);
    this.node = {};
    this.nodes = [];
    this.level = 0;
    this.isSkip = false;
    this.lastEntity = options.lastEntity || '';

    this.setupParserHandlers(options.entityPattern);
    this.stream.pipe(this.parser);
  }

  private setupParserHandlers(entityPattern: RegExp): void {
    this.parser.on('error', (err: Error) => {
      this.emit('error', new Error(err.message));
    });

    this.parser.on('opentag', (_node: sax.Tag) => {
      this.level++;
      const name = _node.name;
      this.isSkip = this.level === 1
        ? false
        : this.level === 2
          ? !entityPattern.test(name)
          : this.isSkip;
      if (this.isSkip) {
        return;
      }
      const child: XmlNode = { ..._node.attributes, _tag: name, _level: this.level };

      if (this.level === this.node._level) {
        this.node = this.nodes[this.nodes.length - 1];
      }

      // 第 1 层不作为第 0 层的 children
      // entity 文件不记录根节点下的 children，否则按需没有意义
      if (this.level > 2) { // 简化条件判断
        if (!this.node.children) {
          this.node.children = [];
        }
        this.node.children.push(child);
      }

      this.node = child;
      this.nodes.push(child);
    });

    this.parser.on('cdata', (txt: string) => {
      if (this.isSkip) {
        return;
      }
      // 直接设置或追加文本，减少条件判断
      if (this.node.text === undefined) {
        this.node.text = txt;
      } else {
        this.node.text += txt;
      }
    })

    this.parser.on('closetag', (name: string) => {
      this.level--;
      if (!this.isSkip && this.level > 0) {
        this.node = this.nodes.pop() || {};

        if (entityPattern.test(name)) {
          this.emit('record', this.node);
        }
      } else {
        // 如果当前标签的字母序已经超过了最后一个实体，提前结束解析
        if (this.lastEntity && this.level === 1 && name.localeCompare(this.lastEntity) > 0) {
          this.stream.destroy();
          this.emit('end');
          return;
        }
        if (this.level === 0) {
          this.emit('end');
        }
      }
    });
  }

  public pause(): void {
    this.stream.pause();
  }

  public resume(): void {
    this.stream.resume();
  }
}
