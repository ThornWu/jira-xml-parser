import { ObjectParser, type XmlNode } from '../xml-parser/object-parser';

type IRecord = Omit<XmlNode, '_tag'>;

export const readObjectFile = async (filename: string, tables: Array<any>) => {
  const tableSet = new Set(tables);
  const lastTable = tables.sort((a, b) => a.localeCompare(b))[tables.length - 1];
  const reader = new ObjectParser(filename, { tableSet, lastTable });
  const records: Record<string, Array<IRecord>> = {};
  let isClearBuffer = false;

  return new Promise((resolve, reject) => {
    reader.on('record', function(_record: XmlNode) {
      const tableName = _record.tableName;
      records[tableName] = [] as Array<IRecord>;
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
      if (!isClearBuffer) {
        isClearBuffer = true;
        reader.clearBuffers();
      }
      reader.destroy();
      resolve(records);
    })

    reader.on('error', function(err: Error) {
      if (!isClearBuffer) {
        isClearBuffer = true;
        reader.clearBuffers();
      }
      reader.destroy();
      reject(err);
    })
  });
}
