export type CameraStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';

export class Camera {
  readonly videoElement: HTMLVideoElement;
  private _isReady = false;
  private _status: CameraStatus = 'idle';
  private _stream: MediaStream | null = null;

  constructor() {
    this.videoElement = document.createElement('video');
    this.videoElement.setAttribute('autoplay', '');
    this.videoElement.setAttribute('muted', '');
    this.videoElement.setAttribute('playsinline', '');
    this.videoElement.style.transform = 'scaleX(-1)';
    this.videoElement.style.display = 'none';
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get status(): CameraStatus {
    return this._status;
  }

  async start(): Promise<void> {
    this._status = 'loading';
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      this.videoElement.srcObject = this._stream;
      await new Promise<void>((resolve, reject) => {
        this.videoElement.onloadedmetadata = () => resolve();
        this.videoElement.onerror = () => reject(new Error('Video load failed'));
      });
      await this.videoElement.play();
      this._isReady = true;
      this._status = 'ready';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        this._status = 'denied';
      } else {
        this._status = 'error';
      }
      throw err;
    }
  }

  stop(): void {
    this._stream?.getTracks().forEach(t => t.stop());
    this._stream = null;
    this._isReady = false;
    this._status = 'idle';
  }

  get width(): number {
    return this.videoElement.videoWidth || 640;
  }

  get height(): number {
    return this.videoElement.videoHeight || 480;
  }
}
