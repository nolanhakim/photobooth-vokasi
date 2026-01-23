'use client';

import { useRef, useState, useEffect } from 'react';
import { Camera, Settings, Timer } from 'lucide-react';

export default function Photobooth() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(3);
  const [photoCount, setPhotoCount] = useState(1);
  const [countdown, setCountdown] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [showFlash, setShowFlash] = useState(false);

  const frameUrl = '/frame1.png';

  useEffect(() => {
    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Browser Anda tidak mendukung akses kamera. Gunakan Chrome, Firefox, atau Edge terbaru.');
          return;
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: false
        });

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setCameraError('');
      } catch (err) {
        console.error('Error accessing camera:', err);
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            setCameraError('Akses kamera ditolak. Mohon izinkan akses kamera di browser Anda.');
          } else if (err.name === 'NotFoundError') {
            setCameraError('Kamera tidak ditemukan. Pastikan perangkat Anda memiliki kamera.');
          } else if (err.name === 'NotReadableError') {
            setCameraError('Kamera sedang digunakan aplikasi lain. Tutup aplikasi lain yang menggunakan kamera.');
          } else {
            setCameraError(`Error kamera: ${err.message}`);
          }
        } else {
          setCameraError('Error kamera tidak diketahui');
        }
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startPhotoSession = async () => {
    setCapturing(true);
    setCapturedPhotos([]);
    setCurrentPhotoIndex(0);
    setMessage('');

    for (let i = 0; i < photoCount; i++) {
      setCurrentPhotoIndex(i + 1);

      for (let sec = timerSeconds; sec > 0; sec--) {
        setCountdown(sec);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setCountdown(0);
      await capturePhoto();

      if (i < photoCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setCapturing(false);
    setCurrentPhotoIndex(0);
    setMessage(`✅ ${photoCount} foto berhasil diambil dan disimpan!`);
    setTimeout(() => setMessage(''), 5000);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const targetWidth = 1080;
    const targetHeight = 1440;
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const videoAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = targetWidth / targetHeight;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (videoAspect > canvasAspect) {
      drawHeight = targetHeight;
      drawWidth = drawHeight * videoAspect;
      offsetX = (targetWidth - drawWidth) / 2;
      offsetY = 0;
    } else {
      drawWidth = targetWidth;
      drawHeight = drawWidth / videoAspect;
      offsetX = 0;
      offsetY = (targetHeight - drawHeight) / 2;
    }

    context.save();
    context.translate(targetWidth, 0);
    context.scale(-1, 1);
    context.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
    context.restore();

    const frameImg = new Image();
    frameImg.crossOrigin = 'anonymous';
    frameImg.src = frameUrl;

    await new Promise((resolve) => {
      frameImg.onload = () => {
        context.drawImage(frameImg, 0, 0, targetWidth, targetHeight);
        resolve(true);
      };
      frameImg.onerror = () => resolve(false);
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedPhotos(prev => [...prev, dataUrl]);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      await uploadPhoto(blob);
    }, 'image/jpeg', 0.95);
  };

  const uploadPhoto = async (blob: Blob) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', blob, `photo-${Date.now()}.jpg`);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!data.success) {
        console.error('Upload failed:', data.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-blue-900 mb-2">📸 Photobooth Vokasi UB</h1>
          <p className="text-slate-600">Fakultas Vokasi • Universitas Brawijaya</p>
        </div>

        {cameraError ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md mx-auto">
            <div className="text-6xl mb-4">📷</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-3">Kamera Tidak Tersedia</h2>
            <p className="text-slate-600 mb-6">{cameraError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Muat Ulang
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="relative aspect-[3/4] bg-slate-900">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                  
                  <img
                    src={frameUrl}
                    alt="Frame"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
                  />

                  {countdown > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/30">
                      <div className="text-9xl font-bold text-white animate-pulse">
                        {countdown}
                      </div>
                    </div>
                  )}

                  {showFlash && (
                    <div className="absolute inset-0 bg-white z-30 animate-pulse"></div>
                  )}

                  {capturing && currentPhotoIndex > 0 && (
                    <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-full font-semibold z-20">
                      Foto {currentPhotoIndex} dari {photoCount}
                    </div>
                  )}

                  {capturedPhotos.length > 0 && capturing && (
                    <div className="absolute bottom-4 right-4 z-20">
                      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
                        <p className="text-xs font-medium text-slate-700 mb-1 px-1">Foto Terakhir</p>
                        <img
                          src={capturedPhotos[capturedPhotos.length - 1]}
                          alt="Last captured"
                          className="w-20 h-28 object-cover rounded"
                        />
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 bg-blue-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-semibold z-20">
                    Vokasi UB
                  </div>
                </div>

                <canvas ref={canvasRef} className="hidden" />
              </div>

              {capturedPhotos.length > 0 && (
                <div className="mt-4 bg-white rounded-xl shadow-lg p-4">
                  <h3 className="font-semibold text-slate-800 mb-3">Foto yang Diambil</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {capturedPhotos.map((photo, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={photo}
                          alt={`Captured ${idx + 1}`}
                          className="w-full aspect-[3/4] object-cover rounded-lg shadow-md group-hover:shadow-xl transition-shadow"
                        />
                        <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                          #{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Pengaturan
                  </h3>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-2 rounded-lg transition-colors ${
                      showSettings ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>

                {showSettings && (
                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                        <Timer className="w-4 h-4" />
                        Jeda Waktu
                      </label>
                      <select
                        value={timerSeconds}
                        onChange={(e) => setTimerSeconds(Number(e.target.value))}
                        className="w-full bg-white text-slate-800 px-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                        disabled={capturing}
                      >
                        <option value={0}>Langsung</option>
                        <option value={3}>3 Detik</option>
                        <option value={5}>5 Detik</option>
                        <option value={10}>10 Detik</option>
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                        <Camera className="w-4 h-4" />
                        Jumlah Foto
                      </label>
                      <select
                        value={photoCount}
                        onChange={(e) => setPhotoCount(Number(e.target.value))}
                        className="w-full bg-white text-slate-800 px-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                        disabled={capturing}
                      >
                        <option value={1}>1 Foto</option>
                        <option value={2}>2 Foto</option>
                        <option value={3}>3 Foto</option>
                        <option value={4}>4 Foto</option>
                        <option value={6}>6 Foto</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={startPhotoSession}
                disabled={capturing || !stream}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${
                  capturing || !stream
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 hover:shadow-xl transform hover:scale-105'
                }`}
              >
                <Camera className="w-6 h-6 inline-block mr-2" />
                {uploading ? 'Mengunggah...' : capturing ? 'Mengambil Foto...' : !stream ? 'Memuat Kamera...' : 'Ambil Foto'}
              </button>

              {message && (
                <div className="bg-green-50 border-2 border-green-200 text-green-800 px-4 py-3 rounded-xl text-center font-medium animate-pulse">
                  {message}
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-4 text-center text-sm text-slate-600">
                © 2026 Fakultas Vokasi UB
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}