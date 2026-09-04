import React from "react";
import {
  CalendarDays,
  Wrench,
  FileText,
} from "lucide-react";

const ServiceInfoCards = () => {
  const cards = [
    {
      icon: CalendarDays,
      title: "Schedule Service",
      description:
        "Schedule maintenance for batteries that require attention.",
    },
    {
      icon: Wrench,
      title: "Maintenance",
      description:
        "Track ongoing inspections, repairs and service activities.",
    },
    {
      icon: FileText,
      title: "Service Records",
      description:
        "Maintain a complete service history for every battery.",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">

      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.title}
            className="
              bg-[#FFFDF8]
              border border-[#EEE8D8]
              rounded-2xl
              p-6
            "
          >

            <div className="
              w-11 h-11
              rounded-xl
              bg-[#F0EDF5]
              flex items-center
              justify-center
            ">
              <Icon className="w-5 h-5 text-[#173B5C]" />
            </div>

            <h3 className="mt-4 font-bold">
              {card.title}
            </h3>

            <p className="mt-1 text-sm text-[#747B83]">
              {card.description}
            </p>

          </div>
        );
      })}

    </div>
  );
};

export default ServiceInfoCards;