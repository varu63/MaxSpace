import { useState, useId } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "./Card";

const faqs = [
  {
    question: "How do I add my battery to MaxSpace?",
    answer:
      "You can add your battery by entering or scanning its unique battery identification details, such as the Battery ID or QR code, depending on how your battery is registered.",
  },
  {
    question: "Can I see my battery's complete information in the app?",
    answer:
      "Yes. MaxSpace provides a centralized digital record of your battery's specifications, health, usage information, warranty and service history.",
  },
  {
    question: "Why is my battery's SoH decreasing over time?",
    answer:
      "Battery capacity naturally decreases with usage and age. Factors such as charging patterns, temperature, usage intensity and number of charge cycles can influence battery degradation.",
  },
  {
    question: "How frequently is my battery health updated?",
    answer:
      "Battery information is updated based on the data received from the battery/BMS and the connected system. The frequency may vary depending on your battery and its connectivity.",
  },
  {
    question: "How can I check my battery warranty?",
    answer:
      "Your warranty information can be viewed directly in the Warranty section of the MaxSpace app.",
  },
  {
    question: "How do I know if my battery is still under warranty?",
    answer:
      "MaxSpace can display your current warranty status and the remaining warranty period associated with your battery.",
  },
  {
    question: "What happens when my battery warranty expires?",
    answer:
      "Your battery information remains accessible, but warranty-related services may no longer be covered under the applicable warranty terms.",
  },
  {
    question: "How can I request battery service through MaxSpace?",
    answer:
      "Go to the Service section, select Raise a Service Request, choose the relevant issue and submit your request.",
  },
  {
    question: "How can I track my service request?",
    answer:
      "Yes. MaxSpace can allow you to track the status of your service request from submission through resolution.",
  },
  {
    question: "How can I see my previous service records?",
    answer:
      "Yes. Your Service History can provide a record of previous inspections, repairs and other service activities associated with your battery.",
  },
  {
    question: "How can I receive warranty expiry reminders?",
    answer:
      "Yes. MaxSpace can provide reminders about upcoming warranty expiry or other important warranty milestones.",
  },
  {
    question: "How can I access my Battery Passport anytime?",
    answer:
      "Yes. Your battery information is available through the MaxSpace app whenever the relevant data and services are accessible.",
  },
  {
    question: "How can I have multiple batteries in one MaxSpace account?",
    answer: "Yes, you can manage multiple registered batteries from a single account.",
  },
  {
    question: "What should I do if I cannot register my battery?",
    answer:
      "Check that the Battery ID or QR code has been entered/scanned correctly. If registration still fails, contact support through the app.",
  },
  {
    question: "How can I report incorrect information in the app?",
    answer:
      "If you believe your battery information is incorrect, contact the service team through MaxSpace and provide the relevant details so the record can be verified.",
  },
];

export default function FAQ({
  title = "Frequently Asked Questions",
  subtitle = "Find answers to the most common questions about our services.",
  items = faqs,
}) {
  const [open, setOpen] = useState(() => new Set());
  const baseId = useId();

  const toggle = (index) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl lg:text-3xl font-bold text-[#16263A]">{title}</h2>
        <p className="mt-1 text-sm text-[#747B83]">{subtitle}</p>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="divide-y divide-[#EEE9DA]">
          {items.map((item, index) => {
            const isOpen = open.has(index);

            return (
              <div key={item.question}>
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                  aria-controls={`${baseId}-faq-panel-${index}`}
                  className="w-full flex items-center justify-between gap-4 px-5 sm:px-7 py-5 text-left transition-colors duration-200 hover:bg-[#F5F1E7] focus:outline-none focus-visible:bg-[#F5F1E7]"
                >
                  <span className="flex-1 min-w-0 text-sm sm:text-base font-semibold text-[#16263A]">
                    {item.question}
                  </span>

                  <span
                    className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      isOpen
                        ? "bg-[#173B5C] border-[#173B5C]"
                        : "bg-[#F5F1E7] border-[#E7E1D3]"
                    }`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-300 ${
                        isOpen ? "rotate-180 text-white" : "text-[#173B5C]"
                      }`}
                    />
                  </span>
                </button>

                <div
                  id={`${baseId}-faq-panel-${index}`}
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 sm:px-7 pb-6 text-sm leading-relaxed text-[#747B83]">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}