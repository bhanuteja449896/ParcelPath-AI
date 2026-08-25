declare module 'pdf-parse' {
  function pdf(dataBuffer: Buffer, options?: any): Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: any;
  }>;
  export = pdf;
}
