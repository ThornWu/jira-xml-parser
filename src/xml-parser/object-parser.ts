// @ts-ignore
import * as sax from "../sax-ts/sax-stream";
import { createReadStream, type ReadStream } from 'fs';
import { EventEmitter } from 'events';

export interface ObjectReaderOptions {
  // 需要提取的表
  tableSet: Set<string>;
  // 最后一个表名，用于提前跳出
  lastTable: string;
}

export interface XmlNode {
  _tag: string;
  name?: string;
  [key: string]: any;
}

export class ObjectParser extends EventEmitter {
  private parser: sax.SAXStream;
  private stream: ReadStream;
  private node: Partial<XmlNode>;
  private nodes: Partial<XmlNode>[];
  private level: number;
  private isSkip: boolean;
  private tableSet: Set<string>;
  private lastTable: string;
  private isLast: boolean;

  constructor(filename: string, options: ObjectReaderOptions) {
    super();

    this.parser = new sax.SAXStream();
    this.stream = createReadStream(filename);
    this.node = {};
    this.nodes = [];
    this.level = 0;
    this.isSkip = false;
    this.isLast = false;
    this.tableSet = options.tableSet;
    this.lastTable = options.lastTable;

    this.setupParserHandlers();
    this.stream.pipe(this.parser);
  }

  private setupParserHandlers(): void {
    this.parser.on('error', (err: Error) => {
      this.emit('error', new Error(err.message));
    });

    this.parser.on('opentag', (_node: sax.Tag) => {
      this.level++;
      if (this.level === 2) {
        this.isSkip =  _node.name !== 'data' || !this.tableSet.has(_node.attributes.tableName);
        this.isLast = this.isSkip && _node.attributes.tableName?.localeCompare(this.lastTable) > 0;
      } else if (this.level === 1) {
        this.isSkip = false;
      }
      if (this.isSkip) {
        return;
      }
      const child = Object.assign(_node.attributes, {
        _tag: _node.name,
        _level: this.level,
        children: [],
      }) as XmlNode;

      if (this.level === this.node._level) {
        this.node = this.nodes[this.nodes.length - 1];
      }

      if (this.level > 2) {
        this.node.children.push(child);
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

    this.parser.on('closetag', () => {
      this.level--;
      this.node = this.nodes.pop() || {};
      if (!this.isSkip && this.level === 1) {
        this.emit('record', this.node);
      }
      if (this.level === 0 || this.isLast) {
        this.stream.destroy();
        this.emit('end');
      }
    });

    this.parser.on('text', (txt: string) => {
      if (this.isSkip) {
        return;
      }
      if (this.node.text === undefined) {
        this.node.text = txt;
      } else {
        this.node.text += txt;
      }
    });
  }

  public pause(): void {
    this.stream.pause();
  }

  public resume(): void {
    this.stream.resume();
  }

  public clearBuffers(): void {
    this.parser._parser?.clearBuffers();
  }

  public destroy(): void {
    this.stream.destroy();
  }
}
