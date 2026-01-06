declare module "recordrtc" {
  const RecordRTC: any;
  export default RecordRTC;

  export class RecordRTCPromisesHandler {
    constructor(...args: any[]);
    startRecording(): Promise<void>;
    stopRecording(): Promise<void>;
    getBlob(): Promise<Blob>;
    destroy(): Promise<void>;
  }
}
