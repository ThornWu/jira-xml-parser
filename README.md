# @thornfe/jira-xml-parser

A lightweight Jira XML parser built on [sax](https://github.com/isaacs/node-sax), specifically designed for handling large files.

> Only support Jira Entity File now.

## Features

- Optimized for large XML files (1GB+)
- Low memory footprint
- Stream processing support
- Written in TypeScript with complete type definitions

## Installation

```bash
npm install @thornfe/jira-xml-parser
```

## Usage

```typescript
import { XmlReader } from '@thornfe/jira-xml-parser';

const reader = new XmlReader();

// Read specific entities
reader.on('entity', (entity) => {
  console.log(entity);
});

// Handle errors
reader.on('error', (error) => {
  console.error(error);
});

// Start parsing
reader.parse('path/to/your/file.xml');
```

## API

### XmlReader

The main parser class that emits the following events:

- `entity`: Triggered when a matching entity is found
- `error`: Triggered when an error occurs during parsing
- `end`: Triggered when parsing is complete

## License

MIT
