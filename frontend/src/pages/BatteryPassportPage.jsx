import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Battery,
  Factory,
  Hash,
  Layers,
  Leaf,
  Activity,
  FileText,
  Wrench,
  CheckCircle2,
} from "lucide-react";

import { useBattery } from "../context/BatteryContext";


// =========================================================
// DETAIL ROW
// =========================================================

const DetailRow = ({ icon: Icon, label, value }) => {
  return (
    <div
      className="
        flex
        items-start
        gap-3
        py-4
        border-b
        border-[#EEE9DA]
        last:border-b-0
      "
    >
      {/* Icon */}
      <div
        className="
          w-9
          h-9
          rounded-lg
          bg-[#F5F1E7]
          flex
          items-center
          justify-center
          shrink-0
        "
      >
        <Icon className="w-4 h-4 text-[#173B5C]" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#737983] mb-1">
          {label}
        </p>

        <p
          className="
            text-sm
            font-semibold
            text-[#16263A]
            leading-relaxed
            break-words
          "
        >
          {value}
        </p>
      </div>
    </div>
  );
};


// =========================================================
// INFO BLOCK
// =========================================================

const InfoBlock = ({
  title,
  icon: Icon,
  children,
}) => {
  return (
    <section
      className="
        rounded-2xl
        bg-[#FFFDF8]
        border
        border-[#EEE9DA]
        shadow-sm
        overflow-hidden
      "
    >
      {/* Header */}
      <div
        className="
          flex
          items-center
          gap-2
          px-5
          py-4
          border-b
          border-[#EEE9DA]
          bg-[#FFFCF5]
        "
      >
        {/* Icon */}
        {Icon && (
          <div
            className="
              w-8
              h-8
              rounded-lg
              bg-[#F5F1E7]
              flex
              items-center
              justify-center
              shrink-0
            "
          >
            <Icon className="w-4 h-4 text-[#B48A18]" />
          </div>
        )}

        {/* Title */}
        <h3
          className="
            text-sm
            font-bold
            text-[#9A8240]
            uppercase
            tracking-wide
          "
        >
          {title}
        </h3>
      </div>

      {/* Content */}
      <div className="px-5">
        {children}
      </div>
    </section>
  );
};


// =========================================================
// BATTERY PASSPORT PAGE
// =========================================================

export default function BatteryPassportPage() {
  const { id } = useParams();

  const navigate = useNavigate();

  const { batteries = [] } = useBattery();


  // -------------------------------------------------------
  // Find Battery
  // -------------------------------------------------------

  const battery = batteries.find(
    (b) => String(b.id) === String(id)
  );


  const batteryId =
    battery?.id ||
    id ||
    "MVAE0014036";


  return (
    <div
      className="
        min-h-screen
        w-full
        bg-[#F8F6EF]

        /* Mobile */
        px-4

        /* Small screen */
        sm:px-8

        /* Tablet */
        md:px-16

        /* Desktop - large left/right margin */
        lg:px-32

        /* Large desktop - very large margin */
        xl:px-48

        py-8
      "
    >

      {/* ===================================================
          CENTERED CONTENT
      ==================================================== */}

      <div
        className="
          w-full
          max-w-5xl
          mx-auto
          space-y-6
        "
      >


        {/* =================================================
            BACK BUTTON
        ================================================== */}

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="
            inline-flex
            items-center
            gap-2
            text-sm
            font-semibold
            text-[#173B5C]
            hover:text-[#B48A18]
            transition-colors
          "
        >
          <ArrowLeft className="w-4 h-4" />

          Back
        </button>


        {/* =================================================
            PAGE TITLE
        ================================================== */}

        <div
          className="
            flex
            flex-col
            sm:flex-row
            sm:items-center
            sm:justify-between
            gap-4
          "
        >
          <div>

            {/* Battery ID Badge */}

            <span
              className="
                inline-flex
                items-center
                rounded-full
                bg-[#173B5C]
                px-3
                py-1
                text-[10px]
                font-semibold
                text-white
                tracking-wide
              "
            >
              {batteryId}
            </span>


            {/* Title */}

            <h1
              className="
                mt-3
                text-2xl
                sm:text-3xl
                font-bold
                text-[#16263A]
              "
            >
              Battery Passport
            </h1>


            {/* Subtitle */}

            <p
              className="
                mt-1
                text-sm
                text-[#6C747D]
              "
            >
              Digital Battery Passport · Compliance Record
            </p>

          </div>
        </div>


        {/* =================================================
            SUMMARY CARD
        ================================================== */}

        <div
          className="
            rounded-2xl
            bg-[#FFFDF8]
            border-2
            border-[#D4C9A0]
            shadow-sm
            overflow-hidden
          "
        >

          {/* Summary Header */}

          <div
            className="
              flex
              items-start
              justify-between
              gap-4
              px-5
              sm:px-6
              py-5
            "
          >

            <div>

              <h2
                className="
                  text-sm
                  font-bold
                  text-[#16263A]
                  tracking-wide
                "
              >
                BATTERY PACK AADHAAR
              </h2>

              <p
                className="
                  text-[10px]
                  text-[#737983]
                  mt-1
                "
              >
                Digital Battery Passport · Compliance Record
              </p>

            </div>


            {/* Shield Icon */}

            <div
              className="
                w-10
                h-10
                rounded-full
                bg-[#D4A843]
                flex
                items-center
                justify-center
                shrink-0
              "
            >
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>

          </div>


          {/* Summary Information */}

          <div
            className="
              grid
              grid-cols-1
              sm:grid-cols-2
              lg:grid-cols-4
              gap-3
              px-5
              sm:px-6
              pb-6
            "
          >

            {/* Battery ID */}

            <div
              className="
                rounded-xl
                bg-[#F5F1E7]
                p-4
              "
            >
              <p
                className="
                  text-[10px]
                  text-[#737983]
                  font-semibold
                  uppercase
                "
              >
                Battery ID
              </p>

              <p
                className="
                  text-sm
                  font-bold
                  text-[#16263A]
                  mt-1
                  break-all
                "
              >
                {batteryId}
              </p>
            </div>


            {/* Model */}

            <div
              className="
                rounded-xl
                bg-[#F5F1E7]
                p-4
              "
            >
              <p
                className="
                  text-[10px]
                  text-[#737983]
                  font-semibold
                  uppercase
                "
              >
                Model
              </p>

              <p
                className="
                  text-sm
                  font-bold
                  text-[#16263A]
                  mt-1
                "
              >
                {battery?.model || "ESS"}
              </p>
            </div>


            {/* Chemistry */}

            <div
              className="
                rounded-xl
                bg-[#F5F1E7]
                p-4
              "
            >
              <p
                className="
                  text-[10px]
                  text-[#737983]
                  font-semibold
                  uppercase
                "
              >
                Chemistry
              </p>

              <p
                className="
                  text-sm
                  font-bold
                  text-[#16263A]
                  mt-1
                "
              >
                {battery?.chemistry || "LFP"}
              </p>
            </div>


            {/* Total Cells */}

            <div
              className="
                rounded-xl
                bg-[#F5F1E7]
                p-4
              "
            >
              <p
                className="
                  text-[10px]
                  text-[#737983]
                  font-semibold
                  uppercase
                "
              >
                Total Cells
              </p>

              <p
                className="
                  text-sm
                  font-bold
                  text-[#16263A]
                  mt-1
                "
              >
                {battery?.cells ||
                  battery?.totalCells ||
                  4}
              </p>
            </div>

          </div>
        </div>


        {/* =================================================
            1. MANUFACTURER IDENTIFIER
        ================================================== */}

        <InfoBlock
          title="Manufacturer Identifier"
          icon={Factory}
        >

          <DetailRow
            icon={Factory}
            label="Country Code"
            value="N/A"
          />

          <DetailRow
            icon={Factory}
            label="Manufacturer Identifier"
            value="N/A"
          />

        </InfoBlock>


        {/* =================================================
            2. BATTERY DESCRIPTOR
        ================================================== */}

        <InfoBlock
          title="Battery Descriptor"
          icon={Battery}
        >

          <DetailRow
            icon={Battery}
            label="Nominal Voltage"
            value="~ 13.34 V"
          />

          <DetailRow
            icon={ShieldCheck}
            label="Extinguisher Class"
            value="Class L"
          />

          <DetailRow
            icon={Layers}
            label="Battery Chemistry"
            value={
              battery?.chemistry || "N/A"
            }
          />

          <DetailRow
            icon={Layers}
            label="Cell Origin"
            value="N/A"
          />

        </InfoBlock>


        {/* =================================================
            3. BATTERY IDENTIFIER
        ================================================== */}

        <InfoBlock
          title="Battery Identifier"
          icon={Hash}
        >

          <DetailRow
            icon={Hash}
            label="Date of Manufacturing"
            value="~ 2026-03-30 07:29:02.114386"
          />

          <DetailRow
            icon={Hash}
            label="Sequential Production Number"
            value={`~ ${batteryId}`}
          />

          <DetailRow
            icon={Hash}
            label="Factory Code"
            value="N/A"
          />

        </InfoBlock>


        {/* =================================================
            4. MATERIAL COMPOSITION
        ================================================== */}

        <InfoBlock
          title="Material Composition"
          icon={Layers}
        >

          <DetailRow
            icon={Layers}
            label="Number of Cells per Battery"
            value="4"
          />

          <DetailRow
            icon={Activity}
            label="Internal Resistance of Battery Pack"
            value="16.19 mOhm"
          />

          <DetailRow
            icon={Layers}
            label="Cell Type"
            value="LFP"
          />

          <DetailRow
            icon={Battery}
            label="BMS Model"
            value="~ 4S 100A DALY"
          />

          <DetailRow
            icon={Layers}
            label="Cell Form Factor"
            value="Prismatic Cell (LFP)"
          />

          <DetailRow
            icon={Layers}
            label="Type of Construction of Battery Pack"
            value="Side by Side Battery Module Placement"
          />

          <DetailRow
            icon={Layers}
            label="Type of Construction of Module"
            value="Linear Alternate terminal Cell arrangement"
          />

          <DetailRow
            icon={Activity}
            label="Type of Cooling System"
            value="None / air-cooled by ambient conditions"
          />

          <DetailRow
            icon={Wrench}
            label="Disassembly Method"
            value="Manual discharge, cut-open casing, separate electrodes"
          />

          <DetailRow
            icon={Leaf}
            label="Circularity Method"
            value="Recycling / hydrometallurgical recovery, Direct, Pyro or other"
          />

          <DetailRow
            icon={Leaf}
            label="Recyclability"
            value="High; typically 85-95% material recovery potential"
          />

          <DetailRow
            icon={Layers}
            label="Material: Anode"
            value="Graphite on copper foil"
          />

          <DetailRow
            icon={Layers}
            label="Material: Cathode"
            value="LFP (LiFePO4) on aluminum foil"
          />

          <DetailRow
            icon={Layers}
            label="Material: Electrolyte"
            value="Liquid lithium-salt electrolyte"
          />

          <DetailRow
            icon={Layers}
            label="Material: Separator"
            value="Microporous polymer separator"
          />

          <DetailRow
            icon={Layers}
            label="Material: Current Collector"
            value="Copper (anode), aluminum (cathode)"
          />

          <DetailRow
            icon={Layers}
            label="Material: Battery Casing"
            value="Mild Steel & Aluminium"
          />

          <DetailRow
            icon={Layers}
            label="Material: Potting / Warranty / Contents"
            value="N/A"
          />

        </InfoBlock>


        {/* =================================================
            5. CARBON FOOTPRINT
        ================================================== */}

        <InfoBlock
          title="Carbon Footprint"
          icon={Leaf}
        >

          <DetailRow
            icon={Leaf}
            label="Total Battery Carbon Footprint Scaled"
            value="41-89 kgCO2e/kWh; working value ~55-65"
          />

          <DetailRow
            icon={Leaf}
            label="Raw Material Acquisition Stage (%)"
            value="35-55% of total"
          />

          <DetailRow
            icon={Leaf}
            label="Manufacturing Stage (%)"
            value="35-50% of total"
          />

          <DetailRow
            icon={Leaf}
            label="Distribution Stage (%)"
            value="1-5% of total"
          />

          <DetailRow
            icon={Leaf}
            label="End of Life & Recycling Stage (%)"
            value="(-5% to +5%), depending on recovery credit"
          />

        </InfoBlock>


        {/* =================================================
            6. DYNAMIC DATA
        ================================================== */}

        <InfoBlock
          title="Dynamic Data"
          icon={Activity}
        >

          <DetailRow
            icon={Activity}
            label="Battery Category"
            value="ESS"
          />

          <DetailRow
            icon={FileText}
            label="Date & Time Stamp"
            value="2026-04-07 13:40:43.542116"
          />

          <DetailRow
            icon={FileText}
            label="BPAN"
            value="N/A"
          />

        </InfoBlock>


        {/* =================================================
            FOOTER NOTE
        ================================================== */}

        <div
          className="
            rounded-2xl
            bg-[#FFF8E7]
            border
            border-[#F0E6C8]
            p-4
            sm:p-5
          "
        >

          <div className="flex items-start gap-3">

            <CheckCircle2
              className="
                w-5
                h-5
                text-[#B48611]
                mt-0.5
                shrink-0
              "
            />

            <p
              className="
                text-sm
                text-[#16263A]
                leading-relaxed
              "
            >
              This record reflects fields available in
              MAXTRACEDB and the Battery Pack Aadhaar
              reference mapping. Values marked '~' are
              derived or proxy fields; fields marked
              'Not available' have no corresponding
              source yet.
            </p>

          </div>

        </div>


        {/* Bottom spacing */}

        <div className="h-6" />

      </div>

    </div>
  );
}
