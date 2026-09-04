import React from 'react';
import { ShieldCheck, Cpu, Leaf, Globe } from 'lucide-react';

export default function Footer(){
  return (
    <footer className="mt-auto border-t border-[#E9E4D7] text-[#F8F2DE] bg-[#16263A] text-xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center space-x-2 text-white font-semibold">
            <ShieldCheck className="w-4 h-4 text-[#B48611]" />
            <span>Compliant with EU Battery Regulation 2023/1542 & Digital Product Passport (DPP) Architecture</span>
          </div>

          <div className="flex items-center space-x-6 text-[#747B83]">
            <span className="flex items-center space-x-1.5 hover:text-[#173B5C] cursor-pointer transition-colors font-medium">
              <Leaf className="w-3.5 h-3.5 text-[#B48611]" />
              <span>ESG Carbon Tracing</span>
            </span>
            <span className="flex items-center space-x-1.5 hover:text-[#173B5C] cursor-pointer transition-colors font-medium">
              <Cpu className="w-3.5 h-3.5 text-[#8A7A4A]" />
              <span>BMS Telemetry v3.4</span>
            </span>
            <span className="flex items-center space-x-1.5 hover:text-[#173B5C] cursor-pointer transition-colors font-medium">
              <Globe className="w-3.5 h-3.5 text-[#747B83]" />
              <span>MaxSpace Global Registry</span>
            </span>
          </div>

        </div>
        <div className="mt-4 pt-4 border-t border-[#ECE7DA] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#8A7A4A]">
          <p>© {new Date().getFullYear()} MaxSpace Battery Passport Systems Inc. All rights reserved.</p>
          <p className="font-mono mt-2 sm:mt-0 text-[#747B83]">Encrypted Ledger Node: <span className="text-[#B48611] font-bold">EU-CENTRAL-01</span> (Active)</p>
        </div>
      </div>
    </footer>
  );
};
