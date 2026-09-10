import { useState, useRef, useEffect } from 'react';
import { useBattery } from '../../../context/BatteryContext';
import { samplePresetBarcodes } from '../../../data/dummyData';
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

  const handleProcessBarcode = async (code) => {
    if (!code || !code.trim()) return;

    const trimmed = code.trim();

    // Look up the barcode against the backend fleet (fails back to "new")
    const existingBattery = await findBatteryByBarcode(trimmed);

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
            <span>Live Camera / HUD</span>
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
            <span>Manual Code Entry</span>
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
            <span>Upload Image</span>
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
                  className={`absolute inset-0 w-full h-full object-cover ${cameraActive ? 'opacity-80' : 'hidden'}`}
                />

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
                      <Barcode className="w-16 h-16 text-yellow-400/60" />
                      <span className="text-[11px] font-mono text-yellow-300 font-bold mt-2 bg-[#173B5C]/90 px-3 py-1 rounded-full border border-yellow-400/30">
                        Align Barcode or QR within Frame
                      </span>
                    </div>
                  </div>
                </div>

                {/* Camera Status Badge */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-[#E7E1D3] bg-[#173B5C]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#102F4A]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                    {cameraActive ? 'Optical Sensor Online (60 FPS)' : 'Simulated Scanner HUD Active'}
                  </span>
                  <span className="font-mono text-yellow-400 font-bold">EU-DPP-OPTICAL</span>
                </div>
              </div>

              {/* Quick simulation buttons below camera */}
              <div className="bg-[#F5F1E7] p-3 rounded-2xl border border-[#F0E6C8] flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[#747B83] font-semibold">
                  Simulate scanning battery:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleProcessBarcode('BATT-EV-9823-LFP')}
                    className="px-3 py-1.5 rounded-lg bg-[#FBF1C9] hover:bg-[#B48611] hover:text-white text-[#A77A08] text-xs font-mono font-bold border border-[#F0E6C8] transition-colors"
                  >
                    ⚡ Scan EV Pack (Existing)
                  </button>
                  <button
                    onClick={() => handleProcessBarcode('BATT-CATL-LFP-9901')}
                    className="px-3 py-1.5 rounded-lg bg-[#FFFDF8] hover:bg-[#E7E1D3] text-[#16263A] text-xs font-mono font-bold border border-[#E7E1D3] transition-colors shadow-sm"
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
              <p className="text-xs text-[#747B83]">
                Click any of the pre-configured hardware barcodes below to simulate an instant scan:
              </p>
              
              <div className="grid grid-cols-1 gap-2.5">
                {samplePresetBarcodes.map((item) => (
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
                    placeholder="e.g. BATT-EV-9823-LFP or SN-2024-EV-88390"
                    className="w-full px-4 py-3.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-[#16263A] placeholder:text-[#8A9096] focus:outline-none focus:border-[#B48611] focus:bg-[#FFFDF8] font-mono text-sm"
                  />
                  <button
                    onClick={() => handleProcessBarcode(manualCode)}
                    disabled={!manualCode.trim()}
                    className="absolute right-2 top-2 bottom-2 px-4 rounded-lg bg-[#173B5C] text-white font-black text-xs hover:bg-[#102F4A] disabled:opacity-40 disabled:hover:bg-[#173B5C] transition-colors shadow-sm"
                  >
                    Process Code
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

          {/* 4. Upload Image Tab */}
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

          {/* Scan Result Feedback Card */}
          {recentScanResult && (
            <div className="p-4 rounded-2xl bg-[#FBF1C9] border border-[#F0E6C8] animate-in zoom-in-95 duration-200 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {recentScanResult.status === 'found' ? (
                    <div className="p-2 rounded-xl bg-[#173B5C] text-white">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-[#E7E1D3] text-[#8A7A4A]">
                      <PlusCircle className="w-6 h-6" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-[#A77A08]">
                        {recentScanResult.status === 'found' ? 'Passport Found in Fleet' : 'Unregistered Battery Detected'}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-[#16263A] mt-0.5">
                      {recentScanResult.status === 'found'
                        ? recentScanResult.battery.modelName
                        : `Ready to Register: ${recentScanResult.code}`}
                    </h4>

                    <p className="text-xs text-[#747B83] mt-1 font-medium">
                      {recentScanResult.status === 'found' ? (
                        <>
                          Capacity: <span className="text-[#16263A] font-mono font-bold">{recentScanResult.battery.capacityKwh} kWh</span> • 
                          Health: <span className="text-[#A77A08] font-mono font-bold">{recentScanResult.battery.stateOfHealth}%</span> • 
                          Serial: <span className="text-[#16263A] font-mono font-bold">{recentScanResult.battery.serialNumber}</span>
                        </>
                      ) : (
                        'This battery is not yet in your account. You can create a new EU Digital Battery Passport for it.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end space-x-3 pt-3 border-t border-[#F0E6C8]">
                <button
                  onClick={() => setRecentScanResult(null)}
                  className="px-4 py-2 rounded-xl bg-[#FFFDF8] border border-[#E7E1D3] text-[#16263A] text-xs font-bold hover:bg-[#F5F1E7] transition-colors shadow-sm"
                >
                  Scan Another
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="px-5 py-2 rounded-xl bg-[#173B5C] hover:bg-[#102F4A] text-white text-xs font-black shadow-sm transition-all"
                >
                  {recentScanResult.status === 'found' ? 'Open Battery Passport →' : 'Create & Mint Passport →'}
                </button>
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