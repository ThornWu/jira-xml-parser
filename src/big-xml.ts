import { Parser } from 'node-expat';
import { createReadStream, type ReadStream } from 'fs';
import { EventEmitter } from 'events';
import { cloneDeep } from 'es-toolkit';

export interface BigXmlReaderOptions {
  /** 一级过滤，过滤 xml 标签名 */
  entityPattern: RegExp;
  /** 节点输出时，是否将 children 展开为节点属性 */
  childrenAsProps?: boolean;
}

export interface XmlNode {
  _tag: string;
  [key: string]: any;
}

class BigXmlReader extends EventEmitter {
  private parser: Parser;
  private stream: ReadStream;
  private node: Partial<XmlNode>;
  private nodes: Partial<XmlNode>[];
  private record: XmlNode | undefined;
  private isCapturing: boolean;
  private level: number;
  private childrenAsProps: boolean;

  constructor(filename: string, options: BigXmlReaderOptions) {
    super();

    this.parser = new Parser('UTF-8');
    this.stream = createReadStream(filename);
    this.node = {};
    this.nodes = [];
    this.record = undefined;
    this.isCapturing = false;
    this.level = 0;
    this.childrenAsProps = options.childrenAsProps || false;

    this.setupStreamHandlers();
    this.setupParserHandlers(options.entityPattern);
  }

  private setupStreamHandlers(): void {
    this.stream.on('data', (data: string | Buffer) => {
      if (!this.parser.parse(data)) {
        this.emit('error', new Error('XML Error: ' + this.parser.getError()));
      } else {
        this.emit('data', data);
      }
    });

    this.stream.on('error', (err: Error) => {
      this.emit('error', new Error(err.message));
    });
  }

  private setupParserHandlers(entityPattern: RegExp): void {
    this.parser.on('startElement', (name: string, attrs: Record<string, string>) => {
      this.level++;

      if (!this.isCapturing && !name.match(entityPattern)) {
        return;
      } else if (!this.isCapturing) {
        this.isCapturing = true;
        this.node = {};
        this.nodes = [];
        this.record = undefined;
      }


      if (!this.node.children) {
        this.node.children = [];
      }

      const child: XmlNode = { _tag: name, ...attrs };

      this.node.children.push(child);

      this.nodes.push(this.node);
      this.node = child;

      if (name.match(entityPattern)) {
        this.record = child;
      }
    });

    this.parser.on('text', (txt: string) => {
      if (!this.isCapturing) {
        return;
      }

      if (txt.length > 0) {
        if (this.node.text === undefined) {
          this.node.text = txt;
        } else {
          this.node.text += txt;
        }
      }
    });

    this.parser.on('endElement', (name: string) => {
      this.level--;
      this.node = this.nodes.pop() || {};

      if (name.match(entityPattern)) {
        this.isCapturing = false;
        if (this.record) {
          if (this.childrenAsProps) {
            let record = cloneDeep(this.record);
            const children = record.children || [];
            record = {...record,...children.reduce((acc: Record<string, XmlNode>, child: XmlNode) => {
              acc[child._tag] = child.text;
              return acc;
            }, {} as Record<string, XmlNode>) };
            delete (record as any)?.children;
            this.emit('record', record);
          } else {
            this.emit('record', this.record);
          }
        }
      }

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

export function createReader(filename: string, options: BigXmlReaderOptions): BigXmlReader {
  return new BigXmlReader(filename, options);
}
