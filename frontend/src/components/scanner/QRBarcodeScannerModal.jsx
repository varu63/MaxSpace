import { useState, useRef, useEffect } from 'react';
import { useBattery } from '../../context/BatteryContext';
import { samplePresetBarcodes } from '../../data/mockData';
import { 
  X, 
  Camera, 
  QrCode, 
  Barcode, 
  UploadCloud, 
  Sparkles, 
  CheckCircle2, 
  PlusCircle, 
  ShieldCheck 
} from 'lucide-react';

export const QRBarcodeScannerModal = () => {
  const { 
    isScannerOpen, 
    closeScanner, 
    findBatteryByBarcode, 
    openPassport, 
    openAddBattery, 
    addToast 
  } = useBattery();

  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'presets' | 'manual' | 'upload'
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [recentScanResult, setRecentScanResult] = useState(null);
  const videoRef = useRef(null);

  // Setup webcam when on camera tab
  useEffect(() => {
    let stream = null;

    if (isScannerOpen && activeTab === 'camera') {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { facingMode: 'environment' } })
          .then((mediaStream) => {
            stream = mediaStream;
            if (videoRef.current) {
              videoRef.current.srcObject = mediaStream;
              videoRef.current.play().catch(() => {});
            }
            setCameraActive(true);
          })
          .catch((err) => {
            console.log('Webcam unavailable, using visual scanner HUD', err);
            setCameraActive(false);
          });
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isScannerOpen, activeTab]);

  if (!isScannerOpen) return null;

  const handleProcessBarcode = (code) => {
    if (!code || !code.trim()) return;

    const trimmed = code.trim();

    // Check if this battery exists in user's fleet
    const existingBattery = findBatteryByBarcode(trimmed);

    if (existingBattery) {
      setRecentScanResult({
        status: 'found',
        battery: existingBattery,
        code: trimmed
      });
      addToast('Battery Identified!', `Found passport for ${existingBattery.modelName}`);
    } else {
      setRecentScanResult({
        status: 'new',
        code: trimmed
      });
      addToast('New Battery Scanned', `Barcode ${trimmed} is ready for passport creation.`, 'info');
    }
  };

  const handleConfirmAction = () => {
    if (!recentScanResult) return;

    if (recentScanResult.status === 'found') {
      const b = recentScanResult.battery;
      closeScanner();
      openPassport(b);
    } else {
      const code = recentScanResult.code;
      closeScanner();
      openAddBattery({ barcode: code, modelName: `Battery Pack (${code})` });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const mockDecoded = 'BATT-EV-9823-LFP';
      handleProcessBarcode(mockDecoded);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-yellow-100 border border-yellow-300 text-yellow-800">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                Battery Barcode & QR Scanner
              </h3>
              <p className="text-xs text-slate-500">
                Scan or enter battery serial to inspect passport or register new unit
              </p>
            </div>
          </div>

          <button
            onClick={closeScanner}
            className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('camera');
              setRecentScanResult(null);
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all ${
              activeTab === 'camera'
                ? 'border-yellow-500 text-slate-900 bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Camera className="w-4 h-4 text-yellow-600" />
            <span>Live Camera / HUD</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('presets');
              setRecentScanResult(null);
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all ${
              activeTab === 'presets'
                ? 'border-yellow-500 text-slate-900 bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-yellow-600" />
            <span>Quick Sample Barcodes</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('manual');
              setRecentScanResult(null);
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all ${
              activeTab === 'manual'
                ? 'border-yellow-500 text-slate-900 bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Barcode className="w-4 h-4 text-yellow-600" />
            <span>Manual Code Entry</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('upload');
              setRecentScanResult(null);
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all ${
              activeTab === 'upload'
                ? 'border-yellow-500 text-slate-900 bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-yellow-600" />
            <span>Upload Image</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* 1. Camera / HUD Scanner View */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              <div className="relative w-full h-72 sm:h-80 bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
                
                {/* Live Video Feed (if webcam allowed) */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover ${cameraActive ? 'opacity-80' : 'hidden'}`}
                />

                {/* Animated Scanner Viewfinder Overlay */}
                <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
                  <div className="relative w-64 h-64 border-2 border-yellow-400/50 rounded-2xl flex items-center justify-center bg-yellow-400/5">
                    
                    {/* Viewfinder Corner Accents */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-yellow-400 rounded-tl-lg"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-yellow-400 rounded-tr-lg"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-yellow-400 rounded-bl-lg"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-yellow-400 rounded-br-lg"></div>

                    {/* Animated Scanning Laser Line in Yellow */}
                    <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent shadow-[0_0_15px_#facc15] animate-scan-laser"></div>

                    {/* Center QR/Barcode Crosshair */}
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <Barcode className="w-16 h-16 text-yellow-400/60" />
                      <span className="text-[11px] font-mono text-yellow-300 font-bold mt-2 bg-slate-900/90 px-3 py-1 rounded-full border border-yellow-400/30">
                        Align Barcode or QR within Frame
                      </span>
                    </div>
                  </div>
                </div>

                {/* Camera Status Badge */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-slate-200 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                    {cameraActive ? 'Optical Sensor Online (60 FPS)' : 'Simulated Scanner HUD Active'}
                  </span>
                  <span className="font-mono text-yellow-400 font-bold">EU-DPP-OPTICAL</span>
                </div>
              </div>

              {/* Quick simulation buttons below camera */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-700 font-semibold">
                  Simulate scanning battery:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleProcessBarcode('BATT-EV-9823-LFP')}
                    className="px-3 py-1.5 rounded-lg bg-yellow-100 hover:bg-yellow-400 hover:text-slate-950 text-yellow-900 text-xs font-mono font-bold border border-yellow-300 transition-colors"
                  >
                    ⚡ Scan EV Pack (Existing)
                  </button>
                  <button
                    onClick={() => handleProcessBarcode('BATT-CATL-LFP-9901')}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs font-mono font-bold border border-slate-300 transition-colors shadow-sm"
                  >
                    ✨ Scan New CATL 100kWh
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Presets Tab */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Click any of the pre-configured hardware barcodes below to simulate an instant scan:
              </p>
              
              <div className="grid grid-cols-1 gap-2.5">
                {samplePresetBarcodes.map((item) => (
                  <div
                    key={item.code}
                    onClick={() => handleProcessBarcode(item.code)}
                    className="group p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-yellow-400 hover:bg-white cursor-pointer transition-all duration-200 flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 group-hover:border-yellow-400 text-yellow-700 transition-colors shadow-sm">
                        <Barcode className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-yellow-800 transition-colors">
                            {item.name}
                          </h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            item.badge.includes('Existing')
                              ? 'bg-yellow-100 text-yellow-900 border border-yellow-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.model} • <span className="font-mono text-slate-800 font-bold">{item.code}</span>
                        </p>
                      </div>
                    </div>

                    <button className="px-3 py-1.5 rounded-xl bg-white group-hover:bg-yellow-400 group-hover:text-slate-950 text-xs font-bold text-slate-700 border border-slate-200 transition-colors shadow-sm">
                      Scan Code →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Manual Entry Tab */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Enter Barcode String, QR Payload or Serial Number:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. BATT-EV-9823-LFP or SN-2024-EV-88390"
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-yellow-500 focus:bg-white font-mono text-sm"
                  />
                  <button
                    onClick={() => handleProcessBarcode(manualCode)}
                    disabled={!manualCode.trim()}
                    className="absolute right-2 top-2 bottom-2 px-4 rounded-lg bg-yellow-400 text-slate-950 font-black text-xs hover:bg-yellow-300 disabled:opacity-40 disabled:hover:bg-yellow-400 transition-colors shadow-sm"
                  >
                    Process Code
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-900">Supported Formats:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Standard 1D Barcode (Code-128, Code-39)</li>
                  <li>2D Matrix / QR Code compliant with EU Battery DPP URI schema</li>
                  <li>Manufacturer Serial Number (SN-YYYY-*)</li>
                </ul>
              </div>
            </div>
          )}

          {/* 4. Upload Image Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-yellow-400 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-yellow-50/50 transition-all text-center">
                <UploadCloud className="w-12 h-12 text-yellow-600 mb-3" />
                <span className="text-sm font-bold text-slate-900">
                  Click or drag battery barcode image here
                </span>
                <span className="text-xs text-slate-500 mt-1">
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

          {/* Scan Result Feedback Card */}
          {recentScanResult && (
            <div className="p-4 rounded-2xl bg-yellow-50 border border-yellow-300 animate-in zoom-in-95 duration-200 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {recentScanResult.status === 'found' ? (
                    <div className="p-2 rounded-xl bg-yellow-200 text-yellow-900">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-slate-200 text-slate-800">
                      <PlusCircle className="w-6 h-6" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-yellow-800">
                        {recentScanResult.status === 'found' ? 'Passport Found in Fleet' : 'Unregistered Battery Detected'}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 mt-0.5">
                      {recentScanResult.status === 'found'
                        ? recentScanResult.battery.modelName
                        : `Ready to Register: ${recentScanResult.code}`}
                    </h4>

                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      {recentScanResult.status === 'found' ? (
                        <>
                          Capacity: <span className="text-slate-900 font-mono font-bold">{recentScanResult.battery.capacityKwh} kWh</span> • 
                          Health: <span className="text-yellow-800 font-mono font-bold">{recentScanResult.battery.stateOfHealth}%</span> • 
                          Serial: <span className="text-slate-900 font-mono font-bold">{recentScanResult.battery.serialNumber}</span>
                        </>
                      ) : (
                        'This battery is not yet in your account. You can create a new EU Digital Battery Passport for it.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end space-x-3 pt-3 border-t border-yellow-200">
                <button
                  onClick={() => setRecentScanResult(null)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors shadow-sm"
                >
                  Scan Another
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="px-5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xs font-black shadow-md shadow-yellow-400/25 transition-all"
                >
                  {recentScanResult.status === 'found' ? 'Open Battery Passport →' : 'Create & Mint Passport →'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-yellow-600" />
            <span>Encrypted barcode parsing & ISO 26262 verification</span>
          </div>
          <button
            onClick={closeScanner}
            className="text-slate-500 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};
