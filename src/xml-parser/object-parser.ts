import * as sax from 'sax';
import { createReadStream, type ReadStream } from 'fs';
import { EventEmitter } from 'events';

export interface ObjectReaderOptions {}

export interface XmlNode {
  _tag: string;
  [key: string]: any;
}

class ObjectParser extends EventEmitter {
  private parser: sax.SAXStream;
  private stream: ReadStream;
  private node: Partial<XmlNode>;
  private nodes: Partial<XmlNode>[];

  private level: number;

  constructor(filename: string) {
    super();

    this.parser = sax.createStream(false, { trim: false });
    this.stream = createReadStream(filename);
    this.node = {};
    this.nodes = [];
    this.level = 0;

    this.setupParserHandlers();
    this.stream.pipe(this.parser);
  }

  private setupParserHandlers(): void {
    this.parser.on('error', (err: Error) => {
      this.emit('error', new Error(err.message));
    });

    this.parser.on('opentag', (_node: sax.Tag) => {
      this.level++;
      const child = Object.assign(_node.attributes, {
        _tag: _node.name,
        _level: this.level,
      }) as XmlNode;

      if (this.level === this.node._level) {
        this.node = this.nodes[this.nodes.length - 1];
      }

      if (!this.node.children) {
        this.node.children = [];
      }
      this.node.children.push(child);

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

      this.emit('record', this.node);

      if (this.level === 0) {
        this.emit('end');
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

export function createObjectParser(filename: string): ObjectParser {
  return new ObjectParser(filename);
}
