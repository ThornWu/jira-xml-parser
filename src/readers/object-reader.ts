import { ObjectParser, type XmlNode } from '../xml-parser/object-parser';

type IRecord = Omit<XmlNode, '_tag'>;

export const readObjectFile = async (filename: string, tables: Array<any>) => {
  return new Promise((resolve, reject) => {
    const tableSet = new Set(tables);
    const lastTable = tables.sort((a, b) => a.localeCompare(b))[tables.length - 1];
    const reader = new ObjectParser(filename, { tableSet, lastTable });
    let isCleanUp = false;
    let records: Record<string, Array<IRecord>> = {};
    const cleanUp = () => {
      if (!isCleanUp) {
        isCleanUp = true;
        reader.clearBuffers();
        reader.destroy();
      }
    }

    reader.on('record', function(_record: XmlNode) {
      const tableName = _record.tableName;
      // 修复内存问题：只在第一次创建数组，避免覆盖已有数据
      if (!records[tableName]) {
        records[tableName] = [] as Array<IRecord>;
      }
      const columns: Array<string> = [];
      _record.children?.forEach((child: XmlNode) => {
        if (child._tag === 'row') {
          const rowValue = child.children?.reduce((acc: Record<string, unknown>, cur: XmlNode, index: number) => {
            acc[columns[index]] = cur.text.trim();
            return acc;
          }, {});
          records[tableName].push(rowValue as IRecord);
        }
        if (child._tag === 'column') {
          columns.push(child.name!.toLowerCase());
        }
      });
    })


    reader.on('end', function() {
      resolve(records);
      cleanUp();
    })

    reader.on('error', function(err: Error) {
      reject(err);
      cleanUp();
    })
  });
}
