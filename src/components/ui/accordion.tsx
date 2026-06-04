import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { motion, type HTMLMotionProps, type Variants } from "motion/react";

import { cn } from "@/lib/utils";

const easeOut = [0.2, 0, 0, 1] as const;
const easeIn = [0.4, 0, 1, 1] as const;

const accordionContentVariants: Variants = {
  open: {
    height: "var(--accordion-panel-height)",
    opacity: 1,
    y: 0,
    transition: {
      height: { duration: 0.22, ease: easeOut },
      opacity: { duration: 0.16, ease: easeOut },
      y: { duration: 0.18, ease: easeOut },
    },
  },
  closed: {
    height: 0,
    opacity: 0,
    y: -4,
    transition: {
      height: { duration: 0.18, ease: easeIn },
      opacity: { duration: 0.12, ease: easeIn },
      y: { duration: 0.14, ease: easeIn },
    },
  },
};

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("not-last:border-b", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex min-w-0 flex-1">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger relative flex flex-1 items-start rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  panelClassName,
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props & { panelClassName?: string }) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={cn(
        "overflow-hidden text-sm transition-[outline-color] duration-200",
        panelClassName,
      )}
      render={(renderProps, state) => (
        <motion.div
          {...(renderProps as HTMLMotionProps<"div">)}
          initial={false}
          animate={state.open ? "open" : "closed"}
          variants={accordionContentVariants}
        />
      )}
      {...props}
    >
      <div
        className={cn(
          "h-(--accordion-panel-height) pt-0 pb-2.5 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
