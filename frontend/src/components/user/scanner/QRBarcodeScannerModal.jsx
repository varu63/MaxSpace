import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { useBattery } from '../../../context/BatteryContext';
import { Modal } from '../../common/Modal';
import { 
  X, 
  Camera, 
  QrCode, 
  Barcode, 
  UploadCloud, 
  Sparkles, 
  CheckCircle2, 
  PlusCircle, 
  ShieldCheck,
  AlertTriangle,
  Loader2,
  FileSearch
} from 'lucide-react';

/* A battery identifier looks like one of:
   - Internal id       → batt-1
   - Barcode           → BATT-EV-9823-LFP
   - Serial number     → SN-2024-EV-88390
   - EU DPP QR URI     → https://passport.battery-eu.org/passports/BATT-EV-9823-LFP
   - Physical QR       → "Battery ID: MVAE0014036\nModel: 12.8V 100AH ...\n..."
   Anything much shorter than that is not a usable battery identifier. */
const isPlausibleBatteryCode = (value) => {
  const clean = String(value || "").trim();
  if (!clean) return false;
  return clean.length >= 4 && /\S/.test(clean);
};

/* Parse a physical QR payload ("Battery ID: X\nModel: Y ...") into structured
   fields so the real identifier is sent for lookup and the scanned values are
   prefilled when a brand-new passport is minted. */
const parseQrPayload = (value) => {
  const clean = String(value || "").trim();
  const grab = (pattern) => {
    const match = clean.match(pattern);
    return match && match[1] ? match[1].trim() : null;
  };
  return {
    batteryId: grab(/Battery\s+ID:\s*([^\r\n]+)/i),
    model: grab(/Model:\s*([^\r\n]+)/i),
    modalId: grab(/Modal\s+ID:\s*([^\r\n]+)/i),
    serialNumber: grab(/Serial(?:\s+Number)?:\s*([^\r\n]+)/i),
    hangStatus: grab(/Hang\s+Status:\s*([^\r\n]+)/i),
    overallStatus: grab(/Overall\s+Status:\s*([^\r\n]+)/i),
  };
};
const hasQrIdentifier = (parsed) =>
  Boolean(parsed && (parsed.batteryId || parsed.modalId || parsed.serialNumber));

/* Cooldown between auto-detections from the live camera stream so a single
   QR held in front of the lens does not fire the lookup repeatedly. */
const DETECT_COOLDOWN_MS = 3000;

/* Whether this page can use the camera at all. getUserMedia is only exposed in
   a secure context (https://, http://localhost, file://); on a plain-HTTP
   hosted/mobile page `navigator.mediaDevices` is undefined even though the
   browser fully supports cameras. Checking the secure context first lets us
   report the true cause instead of a misleading "camera not supported". */
const getCameraSupportError = () => {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return {
      code: 'insecure',
      message:
        'Camera scanning requires a secure (HTTPS) connection. Open this page over HTTPS, or use the Upload / Manual entry options below.',
    };
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return {
      code: 'unsupported',
      message:
        'This browser does not support camera access. Use the Upload or Manual entry options below instead.',
    };
  }
  return null;
};

/* Distinct, user-actionable messages for the ways getUserMedia can fail. */
const describeCameraError = (error) => {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return {
        code: 'denied',
        message:
          'Camera permission was denied. Allow camera access for this site in your browser settings, then tap "Scan with Camera" again — or use Upload / Manual entry.',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        code: 'unavailable',
        message:
          'No camera was found on this device. Use the Upload or Manual entry options below instead.',
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        code: 'busy',
        message:
          'The camera is already in use by another app. Close other camera apps and try again — or use Upload / Manual entry.',
      };
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        code: 'constraints',
        message:
          'This device does not support the requested camera mode. Try again — or use Upload / Manual entry.',
      };
    case 'NotSupportedError':
      return {
        code: 'unsupported',
        message:
          'This browser does not support camera access. Use the Upload or Manual entry options below instead.',
      };
    default:
      return {
        code: 'unknown',
        message:
          'The camera could not be started. Use the Upload or Manual entry options below, or try again.',
      };
  }
};

/* Prefer the rear/environment camera, with graceful fallbacks for browsers and
   WebViews that reject constraint objects. */
const CAMERA_CONSTRAINTS = [
  { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
  { video: { facingMode: 'environment' } },
  { video: true },
];

const requestCameraStream = async () => {
  let lastError = null;
  for (const constraints of CAMERA_CONSTRAINTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      // A denied/blocked/unavailable camera will not succeed with looser
      // constraints, so stop early and surface the real reason.
      const fatal = [
        'NotAllowedError',
        'PermissionDeniedError',
        'SecurityError',
        'NotFoundError',
        'DevicesNotFoundError',
        'NotReadableError',
        'TrackStartError',
      ];
      if (fatal.includes(error?.name)) break;
    }
  }
  throw lastError || new Error('Camera unavailable');
};

export const QRBarcodeScannerModal = () => {
  const navigate = useNavigate();
  const { 
    batteries,
    isScannerOpen, 
    closeScanner, 
    findBatteryByBarcode, 
    openAddBattery, 
    addToast 
  } = useBattery();

  /* Presets are built from the operator's real fleet records (PostgreSQL),
     so the "try a registered barcode" shortcuts never invent sample units. */
  const fleetPresets = useMemo(
    () =>
      batteries
        .filter((battery) => battery.barcode)
        .slice(0, 10)
        .map((battery) => ({
          code: battery.barcode,
          name: battery.modelName || battery.name || battery.barcode,
          model:
            battery.model ||
            battery.chemistry ||
            (battery.capacityKwh ? `${battery.capacityKwh} kWh` : "Battery"),
          badge: "Existing in Fleet",
        })),
    [batteries]
  );

  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'presets' | 'manual' | 'upload'
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  /* { code, message } — `code` selects the guidance/retry affordances. */
  const [cameraError, setCameraError] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [recentScanResult, setRecentScanResult] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const cameraSessionRef = useRef(0);
  const lastDetectedRef = useRef({ code: "", at: 0 });

  const handleProcessBarcode = useCallback(
    async (rawCode) => {
      const code = String(rawCode || "").trim();
      if (!code) {
        setRecentScanResult({ status: 'error', code: '', error: 'The scanned code is empty. Please try again.' });
        addToast('Scan Failed', 'No barcode content was decoded.', 'error');
        return;
      }

      // Clear any previous scan result so a new QR never shows stale data.
      setRecentScanResult(null);

      if (!isPlausibleBatteryCode(code)) {
        setRecentScanResult({
          status: 'error',
          code,
          error: `"${code}" is not a valid battery identifier. Try a battery barcode / serial or the EU passport QR code.`,
        });
        addToast('Invalid Barcode', 'This QR code is not a recognized battery passport.', 'error');
        return;
      }

      // Physical QR payloads carry the identifier inside key: value lines —
      // look it up by the real Battery/Modal ID while keeping the raw payload
      // for the prefill when the unit is not registered yet.
      const parsed = parseQrPayload(code);
      const payloadFields = hasQrIdentifier(parsed) ? parsed : null;
      const lookupId =
        payloadFields?.batteryId || payloadFields?.modalId || payloadFields?.serialNumber || code;

      setLookingUp(true);
      try {
        // Look up the decoded value against the fleet API (barcode | serial | id | EU QR URI |
        // physical QR payload identifier).
        const existingBattery = await findBatteryByBarcode(lookupId);

        if (existingBattery) {
          setRecentScanResult({
            status: 'found',
            battery: existingBattery,
            code
          });
          addToast('Battery Identified!', `Found passport for ${existingBattery.modelName}`);
        } else {
          setRecentScanResult({
            status: 'new',
            code,
            parsedPayload: payloadFields
          });
          addToast('New Battery Scanned', `Barcode ${lookupId} is ready for passport creation.`, 'info');
        }
      } catch (error) {
        const status = error?.status;
        let errorText;
        if (status === 400) {
          errorText = 'That code is not a valid battery identifier. Check the QR / barcode and try again.';
        } else if (status >= 500) {
          errorText = 'The battery database is unavailable right now. Please try again in a moment.';
        } else if (!status) {
          errorText = 'Cannot reach the battery service. Check your connection and try again.';
        } else {
          errorText = 'The battery lookup failed. Please try again, or switch to manual entry.';
        }
        setRecentScanResult({ status: 'error', code, error: errorText });
        addToast('Lookup Failed', error?.message || errorText, 'error');
      } finally {
        setLookingUp(false);
      }
    },
    [findBatteryByBarcode, addToast]
  );

  /* Decode a video frame using jsQR. Runs in a rAF loop while the camera
     tab is open so a battery QR held in front of the lens is detected.
     Repeated detections of the same code within the cooldown window are
     ignored to avoid re-firing the lookup while the QR stays in view.
     The loop keeps running so after "Scan Another" the user can just
     hold up the next QR. */
  const startScanLoop = useCallback(() => {
    const scanFrame = () => {
      let codeFound = false;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) {
          const now = Date.now();
          const last = lastDetectedRef.current;
          if (last.code !== code.data || now - last.at > DETECT_COOLDOWN_MS) {
            lastDetectedRef.current = { code: code.data, at: now };
            codeFound = true;
            handleProcessBarcode(code.data);
          }
        }
      }
      if (!codeFound) {
        rafRef.current = requestAnimationFrame(scanFrame);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [handleProcessBarcode]);

  /* Release the camera hardware and stop the decode loop. Safe to call when
     nothing is running. Bumping the session id invalidates any in-flight
     getUserMedia so its stream is stopped instead of leaking. */
  const stopCamera = useCallback(() => {
    cameraSessionRef.current += 1;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        // Some browsers reject clearing srcObject — ignore.
      }
    }
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  /* Explicitly start the rear camera. Only ever called from the user's
     "Scan with Camera" tap, so the permission prompt is user-initiated. */
  const startCamera = useCallback(async () => {
    setRecentScanResult(null);

    const supportError = getCameraSupportError();
    if (supportError) {
      setCameraActive(false);
      setCameraStarting(false);
      setCameraError(supportError);
      return;
    }

    stopCamera();
    setCameraError(null);
    setCameraStarting(true);

    const session = cameraSessionRef.current;
    let stream;
    try {
      stream = await requestCameraStream();
    } catch (error) {
      setCameraStarting(false);
      setCameraError(describeCameraError(error));
      return;
    }

    // Modal closed / tab switched / restarted while the prompt was open.
    if (session !== cameraSessionRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay may be deferred; the frame loop tolerates a paused start.
      }
    }
    setCameraActive(true);
    setCameraStarting(false);
    setCameraError(null);
    lastDetectedRef.current = { code: "", at: 0 };
    startScanLoop();
  }, [startScanLoop, stopCamera]);

  // Release the camera the moment the scanner closes or another tab is chosen.
  useEffect(() => {
    if (!isScannerOpen || activeTab !== 'camera') {
      stopCamera();
    }
  }, [isScannerOpen, activeTab, stopCamera]);

  // Final safety net: always release the camera on unmount.
  useEffect(() => stopCamera, [stopCamera]);

  // Reset detected-code memory when the modal closes so re-opening rescans
  useEffect(() => {
    if (!isScannerOpen) {
      lastDetectedRef.current = { code: "", at: 0 };
    }
  }, [isScannerOpen]);

  if (!isScannerOpen) return null;

  const handleConfirmAction = () => {
    if (!recentScanResult) return;

    if (recentScanResult.status === 'found') {
      const b = recentScanResult.battery;
      closeScanner();
      navigate(`/battery/${b.id}/passport`);
    } else if (recentScanResult.status === 'new') {
      const code = recentScanResult.code;
      const parsed = recentScanResult.parsedPayload || {};
      closeScanner();
      openAddBattery({
        barcode: parsed.batteryId || parsed.modalId || parsed.serialNumber || code,
        modelName: parsed.model || `Battery Pack (${code})`,
        modalId: parsed.modalId || null,
        hangStatus: parsed.hangStatus || null,
        overallStatus: parsed.overallStatus || null,
        serialNumber: parsed.serialNumber || "",
      });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (decoded?.data) {
            handleProcessBarcode(decoded.data);
          } else {
            setRecentScanResult({
              status: 'error',
              code: '',
              error: 'No QR or barcode could be decoded from this image. Use a clearer, well-lit photo.',
            });
            addToast('No Barcode Found', 'The uploaded image does not contain a readable barcode.', 'error');
          }
        } catch {
          setRecentScanResult({
            status: 'error',
            code: '',
            error: 'Could not read the uploaded image. Please try another photo.',
          });
          addToast('Decode Failed', 'The uploaded image could not be processed.', 'error');
        }
      };
      img.onerror = () => {
        setRecentScanResult({
          status: 'error',
          code: '',
          error: 'The uploaded file could not be read as an image.',
        });
        addToast('Invalid Image', 'Please upload a PNG, JPG or WEBP photo.', 'error');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <Modal isOpen={isScannerOpen} onClose={closeScanner} z={50}>
      <div
        className="relative w-full max-w-2xl bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#16263A]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#EEE9DA] bg-[#F5F1E7]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#FBF1C9] border border-[#F0E6C8] text-[#A77A08]">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#16263A] flex items-center gap-2">
                Battery Barcode & QR Scanner
              </h3>
              <p className="text-xs text-[#747B83]">
                Scan or enter battery serial to inspect passport or register new unit
              </p>
            </div>
          </div>

          <button
            onClick={closeScanner}
            className="p-2 text-[#8A9096] hover:text-[#16263A] rounded-xl hover:bg-[#E7E1D3] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#EEE9DA] bg-[#F5F1E7] px-6 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('camera');
              setRecentScanResult(null);
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all ${
              activeTab === 'camera'
                ? 'border-[#B48611] text-[#16263A] bg-[#FFFDF8] font-black'
                : 'border-transparent text-[#747B83] hover:text-[#16263A] hover:bg-[#F0E6C8]/50'
            }`}
          >
            <Camera className="w-4 h-4 text-[#B48611]" />
            <span>Scan with Camera</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('presets');
              setRecentScanResult(null);
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all ${
              activeTab === 'presets'
                ? 'border-[#B48611] text-[#16263A] bg-[#FFFDF8] font-black'
                : 'border-transparent text-[#747B83] hover:text-[#16263A] hover:bg-[#F0E6C8]/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#B48611]" />
            <span>Quick Sample Barcodes</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('manual');
              setRecentScanResult(null);
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all ${
              activeTab === 'manual'
                ? 'border-[#B48611] text-[#16263A] bg-[#FFFDF8] font-black'
                : 'border-transparent text-[#747B83] hover:text-[#16263A] hover:bg-[#F0E6C8]/50'
            }`}
          >
            <Barcode className="w-4 h-4 text-[#B48611]" />
            <span>Enter QR/Battery ID</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('upload');
              setRecentScanResult(null);
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all ${
              activeTab === 'upload'
                ? 'border-[#B48611] text-[#16263A] bg-[#FFFDF8] font-black'
                : 'border-transparent text-[#747B83] hover:text-[#16263A] hover:bg-[#F0E6C8]/50'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-[#B48611]" />
            <span>Upload QR Image</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* 1. Camera / HUD Scanner View */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              <div className="relative w-full h-72 sm:h-80 bg-[#16263A] rounded-2xl overflow-hidden border border-[#16263A] flex items-center justify-center">
                
                {/* Live Video Feed (if webcam allowed) */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`absolute inset-0 w-full h-full object-cover ${cameraActive ? 'opacity-80' : 'hidden'}`}
                />

                {/* Hidden canvas used for frame decoding */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Animated Scanner Viewfinder Overlay */}
                <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
                  <div className="relative w-[min(100%,16rem)] aspect-square border-2 border-yellow-400/50 rounded-2xl flex items-center justify-center bg-yellow-400/5">
                    
                    {/* Viewfinder Corner Accents */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-yellow-400 rounded-tl-lg"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-yellow-400 rounded-tr-lg"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-yellow-400 rounded-bl-lg"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-yellow-400 rounded-br-lg"></div>

                    {/* Animated Scanning Laser Line in Yellow */}
                    <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent shadow-[0_0_15px_#facc15] animate-scan-laser"></div>

                    {/* Center QR/Barcode Crosshair */}
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      {/* When the camera is running, the lock-on frame is aimed at a
                          QR code held within the viewfinder. */}
                      {cameraActive ? (
                        <QrCode className="w-16 h-16 text-yellow-400/60" />
                      ) : (
                        <FileSearch className="w-16 h-16 text-yellow-400/60" />
                      )}
                      <span className="text-[11px] font-mono text-yellow-300 font-bold mt-2 bg-[#173B5C]/90 px-3 py-1 rounded-full border border-yellow-400/30">
                        {cameraActive
                          ? 'Align QR Code within Frame'
                          : cameraStarting
                            ? 'Starting Camera…'
                            : 'Camera Is Off'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Camera Status / Error Badge */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-[11px] text-[#E7E1D3] bg-[#173B5C]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#102F4A]">
                  {cameraError ? (
                    <span className="flex items-center gap-1.5 font-medium text-[#F8C7C7] truncate">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {cameraError.code === 'insecure' ? 'HTTPS required for camera' : 'Camera unavailable'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 font-medium">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          cameraActive ? 'bg-yellow-400 animate-pulse' : 'bg-[#8A9096]'
                        }`}
                      ></span>
                      {cameraActive
                        ? 'Optical Scanner Live — decoding in real time'
                        : cameraStarting
                          ? 'Starting camera…'
                          : 'Camera is off'}
                    </span>
                  )}
                  <span className="font-mono text-yellow-400 font-bold">EU-DPP-OPTICAL</span>
                </div>
              </div>

              {/* Camera controls — permission is only requested from this
                  explicit user tap (never automatically on open). */}
              {!cameraActive && !cameraStarting && !cameraError && (
                <button
                  onClick={startCamera}
                  className="w-full py-3 rounded-xl bg-[#173B5C] hover:bg-[#102F4A] text-white text-sm font-black shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Scan with Camera
                </button>
              )}

              {cameraStarting && (
                <div className="w-full py-3 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-xs font-semibold text-[#16263A] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 text-[#B48611] animate-spin" />
                  Waiting for camera permission…
                </div>
              )}

              {cameraActive && (
                <button
                  onClick={stopCamera}
                  className="w-full py-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-[#16263A] text-xs font-bold hover:bg-[#E7E1D3] transition-colors"
                >
                  Stop Camera
                </button>
              )}

              {cameraError && (
                <div className="p-4 rounded-2xl bg-[#FBEDED] border border-[#F2C4C0] space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#B03A2E] shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-[#B03A2E]">{cameraError.message}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cameraError.code !== 'insecure' && cameraError.code !== 'unsupported' && (
                      <button
                        onClick={startCamera}
                        className="px-4 py-2 rounded-xl bg-[#173B5C] hover:bg-[#102F4A] text-white text-xs font-black transition-colors flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Try Camera Again
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setActiveTab('upload');
                        setRecentScanResult(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] text-[#16263A] text-xs font-bold hover:bg-[#F5F1E7] transition-colors"
                    >
                      Upload QR Image
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('manual');
                        setRecentScanResult(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] text-[#16263A] text-xs font-bold hover:bg-[#F5F1E7] transition-colors"
                    >
                      Enter ID Manually
                    </button>
                  </div>
                </div>
              )}

              {/* Real fleet barcodes below camera (trigger the real API lookup) */}
              {fleetPresets.length > 0 && (
                <div className="bg-[#F5F1E7] p-3 rounded-2xl border border-[#F0E6C8] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-[#747B83] font-semibold">
                    Try a registered fleet barcode:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {fleetPresets.slice(0, 2).map((item, index) => (
                      <button
                        key={item.code}
                        onClick={() => handleProcessBarcode(item.code)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                          index === 0
                            ? "bg-[#FBF1C9] hover:bg-[#B48611] hover:text-white text-[#A77A08] border-[#F0E6C8]"
                            : "bg-[#FFFDF8] hover:bg-[#E7E1D3] text-[#16263A] border-[#E7E1D3] shadow-sm"
                        }`}
                      >
                        {item.code}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Presets Tab */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <p className="text-xs text-[#747B83]">
                Click any of your registered fleet barcodes below to run an instant scan:
              </p>

              {fleetPresets.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] text-xs text-[#747B83]">
                  No batteries registered yet. Use the Camera, Upload, or Manual Entry tabs to register your first battery.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                {fleetPresets.map((item) => (
                  <div
                    key={item.code}
                    onClick={() => handleProcessBarcode(item.code)}
                    className="group p-4 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] hover:border-[#B48611] hover:bg-[#FFFDF8] cursor-pointer transition-all duration-200 flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="p-2.5 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] group-hover:border-[#B48611] text-[#A77A08] transition-colors shadow-sm">
                        <Barcode className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-[#16263A] group-hover:text-[#8A7A4A] transition-colors">
                            {item.name}
                          </h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            item.badge.includes('Existing')
                              ? 'bg-yellow-100 text-yellow-900 border border-yellow-300'
                              : 'bg-[#E7E1D3] text-[#747B83]'
                          }`}>
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs text-[#747B83] mt-0.5">
                          {item.model} • <span className="font-mono text-[#16263A] font-bold">{item.code}</span>
                        </p>
                      </div>
                    </div>

                    <button className="px-3 py-1.5 rounded-xl bg-[#FFFDF8] group-hover:bg-[#B48611] group-hover:text-white text-xs font-bold text-[#16263A] border border-[#E7E1D3] transition-colors shadow-sm">
                      Scan Code →
                    </button>
                  </div>
                ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Manual Entry Tab */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#16263A] mb-2">
                  Enter Barcode String, QR Payload or Serial Number:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualCode.trim()) handleProcessBarcode(manualCode);
                    }}
                    placeholder="e.g. BATT-EV-9823-LFP or SN-2024-EV-88390"
                    className="w-full px-4 py-3.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-[#16263A] placeholder:text-[#8A9096] focus:outline-none focus:border-[#B48611] focus:bg-[#FFFDF8] font-mono text-sm"
                  />
                  <button
                    onClick={() => handleProcessBarcode(manualCode)}
                    disabled={!manualCode.trim() || lookingUp}
                    className="absolute right-2 top-2 bottom-2 px-4 rounded-lg bg-[#173B5C] text-white font-black text-xs hover:bg-[#102F4A] disabled:opacity-40 disabled:hover:bg-[#173B5C] transition-colors shadow-sm"
                  >
                    {lookingUp ? 'Checking…' : 'Process Code'}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] text-xs text-[#747B83] space-y-1.5">
                <p className="font-bold text-[#16263A]">Supported Formats:</p>
                <ul className="list-disc list-inside space-y-1 text-[#747B83]">
                  <li>Standard 1D Barcode (Code-128, Code-39)</li>
                  <li>2D Matrix / QR Code compliant with EU Battery DPP URI schema</li>
                  <li>Manufacturer Serial Number (SN-YYYY-*)</li>
                </ul>
              </div>
            </div>
          )}

          {/* 4. Upload QR Image Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-[#E7E1D3] hover:border-[#B48611] rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer bg-[#F5F1E7] hover:bg-[#FBF1C9]/40 transition-all text-center">
                <UploadCloud className="w-12 h-12 text-[#B48611] mb-3" />
                <span className="text-sm font-bold text-[#16263A]">
                  Click or drag battery barcode image here
                </span>
                <span className="text-xs text-[#747B83] mt-1">
                  Supports PNG, JPG, WEBP photos of battery nameplates or QR stickers
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Scanning / lookup in progress */}
          {lookingUp && !recentScanResult && (
            <div className="p-4 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] flex items-center gap-3 text-sm text-[#16263A]">
              <Loader2 className="w-5 h-5 text-[#B48611] animate-spin" />
              <span className="font-semibold">Looking up battery in the fleet database…</span>
            </div>
          )}

          {/* Scan Result Feedback Card */}
          {recentScanResult && (
            <div className={`p-4 rounded-2xl border animate-in zoom-in-95 duration-200 shadow-sm ${
              recentScanResult.status === 'error'
                ? 'bg-[#FBEDED] border-[#F2C4C0]'
                : 'bg-[#FBF1C9] border-[#F0E6C8]'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {recentScanResult.status === 'found' ? (
                    <div className="p-2 rounded-xl bg-[#173B5C] text-white">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : recentScanResult.status === 'new' ? (
                    <div className="p-2 rounded-xl bg-[#E7E1D3] text-[#8A7A4A]">
                      <PlusCircle className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-[#C0392B] text-white">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-extrabold uppercase tracking-wider ${
                        recentScanResult.status === 'found'
                          ? 'text-[#A77A08]'
                          : recentScanResult.status === 'new'
                            ? 'text-[#8A7A4A]'
                            : 'text-[#B03A2E]'
                      }`}>
                        {recentScanResult.status === 'found'
                          ? 'Passport Found in Fleet'
                          : recentScanResult.status === 'new'
                            ? 'Unregistered Battery Detected'
                            : 'Scan Error'}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-[#16263A] mt-0.5">
                      {recentScanResult.status === 'found'
                        ? recentScanResult.battery.modelName
                        : recentScanResult.status === 'new'
                          ? `Ready to Register: ${recentScanResult.code}`
                          : recentScanResult.error}
                    </h4>

                    <p className="text-xs text-[#747B83] mt-1 font-medium">
                      {recentScanResult.status === 'found' ? (
                        <>
                          Capacity: <span className="text-[#16263A] font-mono font-bold">{recentScanResult.battery.capacityKwh} kWh</span> • 
                          Health: <span className="text-[#A77A08] font-mono font-bold">{recentScanResult.battery.stateOfHealth}%</span> • 
                          Serial: <span className="text-[#16263A] font-mono font-bold">{recentScanResult.battery.serialNumber}</span>
                        </>
                      ) : recentScanResult.status === 'new' ? (
                        'This battery is not yet in your account. You can create a new EU Digital Battery Passport for it.'
                      ) : (
                        'Double-check the code and try again, or switch to manual entry.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end space-x-3 pt-3 border-t border-[#F0E6C8]">
                <button
                  onClick={() => {
                    setRecentScanResult(null);
                    lastDetectedRef.current = { code: "", at: 0 };
                    if (activeTab === 'camera' && cameraActive) startScanLoop();
                  }}
                  className="px-4 py-2 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] text-[#16263A] text-xs font-bold hover:bg-[#F5F1E7] transition-colors shadow-sm"
                >
                  {recentScanResult.status === 'error' ? 'Try Again' : 'Scan Another'}
                </button>
                {recentScanResult.status !== 'error' && (
                  <button
                    onClick={handleConfirmAction}
                    className="px-5 py-2 rounded-xl bg-[#173B5C] hover:bg-[#102F4A] text-white text-xs font-black shadow-sm transition-all flex items-center gap-2"
                  >
                    {recentScanResult.status === 'found' ? (
                      'Open Battery Passport →'
                    ) : (
                      'Create & Mint Passport →'
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#F5F1E7] border-t border-[#EEE9DA] flex flex-wrap items-center justify-between gap-2 text-xs text-[#747B83]">
          <div className="flex items-center space-x-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-[#B48611] shrink-0" />
            <span className="truncate">Encrypted barcode parsing &amp; ISO 26262 verification</span>
          </div>
          <button
            onClick={closeScanner}
            className="text-[#747B83] hover:text-[#16263A] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};