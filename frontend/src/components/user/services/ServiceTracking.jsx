import React from "react";
import { Check, Clock } from "lucide-react";
import { getTrackingMilestones, isServiceBooked } from "./tracking";

/* ============================================================
   ServiceTracking
   Reusable delivery-style tracking timeline.
   Horizontal on desktop, converts to a vertical timeline on
   small screens so there is never horizontal overflow.
   Props:
     - status        : the service's existing status field
     - timestamps    : optional object keyed by stage key ->
                        { time } shown under a milestone
     - label         : optional section label above the timeline
 ============================================================ */

const Marker = ({ state, cancelled, stageKey }) => {
  if (cancelled && state === "current") {
    return (
      <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-red-100 border-2 border-red-400 text-red-600">
        <Clock className="w-4 h-4" />
      </span>
    );
  }

  if (state === "completed") {
    return (
      <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white shadow-sm">
        <Check className="w-4 h-4" strokeWidth={3} />
      </span>
    );
  }

  if (state === "current") {
    // While waiting for admin approval the current (Booked) milestone is
    // highlighted YELLOW; every later stage uses the green accent.
    const isPending = stageKey === "Booked";

    return (
      <span
        className={`
          relative z-10 flex items-center justify-center w-8 h-8 rounded-full
          text-white shadow-md
          ${
            isPending
              ? "bg-[#EAB308] ring-4 ring-yellow-100"
              : "bg-green-600 ring-4 ring-green-100"
          }
        `}
      >
        <span className="w-3 h-3 rounded-full bg-white" />
      </span>
    );
  }

  return (
    <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-[#EDEBE2] border-2 border-[#E0DCCF]">
      <span className="w-2.5 h-2.5 rounded-full bg-[#C9C5B8]" />
    </span>
  );
};

// A connective line segment is GREEN once its destination milestone has
// been reached (completed or current); otherwise it stays neutral gray.
const isSegmentReached = (step) => step?.state !== "upcoming";

const MilestoneLabel = ({ step, cancelled }) => (
  <div
    className={`
      px-2 text-center
      ${step.state === "current" ? "" : "text-[#747B83]"}
    `}
  >
    <p
      className={`
        text-xs font-semibold leading-tight
        ${step.state === "completed" ? "text-green-700" : ""}
        ${step.state === "current" && !cancelled ? "text-[#16263A]" : ""}
        ${cancelled && step.state === "current" ? "text-red-600" : ""}
      `}
    >
      {step.label}
    </p>
    {step.time && (
      <p className="mt-1 text-[11px] text-[#747B83]">{step.time}</p>
    )}
  </div>
);

const Line = ({ reached }) => (
  <div
    className={`flex-1 h-0.5 mx-1 ${
      reached ? "bg-green-500" : "bg-[#E0DCCF]"
    }`}
  />
);

const HorizontalTimeline = ({ milestones, cancelled }) => (
  <div className="relative hidden md:block">
    <div className="flex items-start">
      {milestones.map((step, index) => {
        const prev = milestones[index - 1];
        const next = milestones[index + 1];

        return (
          <div
            key={step.key}
            className="flex flex-col items-center flex-1"
          >
            <div className="flex items-center w-full h-8">
              {prev ? (
                <Line reached={isSegmentReached(step)} />
              ) : (
                <div className="flex-1" />
              )}

<Marker state={step.state} cancelled={cancelled} stageKey={step.key} />

              {next ? (
                <Line reached={isSegmentReached(next)} />
              ) : (
                <div className="flex-1" />
              )}
            </div>

            <div className="mt-3 w-full">
              <MilestoneLabel step={step} cancelled={cancelled} />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const VerticalTimeline = ({ milestones, cancelled }) => (
  <div className="md:hidden">
    {milestones.map((step, index) => {
      const prev = milestones[index - 1];
      const next = milestones[index + 1];

      return (
        <div key={step.key} className="flex">
          <div className="flex flex-col items-center mr-4 w-8">
            <div
              className={`w-px h-6 ${
                prev
                  ? isSegmentReached(step)
                    ? "bg-green-500"
                    : "bg-[#E0DCCF]"
                  : "bg-transparent"
              }`}
            />

            <Marker state={step.state} cancelled={cancelled} />

            {next && (
              <div
                className={`flex-1 min-h-[2rem] w-px ${
                  isSegmentReached(next)
                    ? "bg-green-500"
                    : "bg-[#E0DCCF]"
                }`}
              />
            )}
          </div>

          <div className="pb-6 pt-1">
            <MilestoneLabel step={step} cancelled={cancelled} />
          </div>
        </div>
      );
    })}
  </div>
);

const ServiceTracking = ({ status, timestamps = {}, label }) => {
  const milestones = getTrackingMilestones(status);
  const cancelled = (status || "").toLowerCase() === "cancelled";

  const withTime = milestones.map((step) => ({
    ...step,
    time: timestamps?.[step.key]?.time,
  }));

  return (
    <div>
      {label && (
        <p className="text-xs font-semibold text-[#747B83] uppercase tracking-wide mb-4">
          {label}
        </p>
      )}

      {isServiceBooked(status) && !cancelled && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FBF1C9] text-[#A77A08] text-xs font-semibold">
          <Clock className="w-3.5 h-3.5" />
          Waiting for admin approval
        </div>
      )}

      {cancelled && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
          <Clock className="w-3.5 h-3.5" />
          Service cancelled
        </div>
      )}

      <HorizontalTimeline milestones={withTime} cancelled={cancelled} />
      <VerticalTimeline milestones={withTime} cancelled={cancelled} />
    </div>
  );
};

export default React.memo(ServiceTracking);