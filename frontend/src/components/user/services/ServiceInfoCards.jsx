import React from "react";
import {
  CalendarDays,
  Wrench,
  FileText,
} from "lucide-react";
import { Card, IconBox } from "../common";

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
          <Card key={card.title}>
            <IconBox icon={Icon} size="lg" />

            <h3 className="mt-4 font-bold text-lg text-[#16263A]">
              {card.title}
            </h3>

            <p className="mt-1 text-sm text-[#747B83]">
              {card.description}
            </p>
          </Card>
        );
      })}
    </div>
  );
};

export default React.memo(ServiceInfoCards);

