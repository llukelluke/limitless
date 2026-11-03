import { useState } from 'react'
import { AccountantCalculator } from '@pluperfect/react-accountant-calculator'
import '@pluperfect/react-accountant-calculator/styles.css'
import './CalculatorButton.css'

// Floating accountant's calculator, opened from the service toolbar on every page.
export default function CalculatorButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="app__service"
        aria-pressed={open}
        title="Open a calculator (it floats above the page and can be dragged)"
        onClick={() => setOpen((value) => !value)}
      >
        Calculator
      </button>
      <AccountantCalculator
        open={open}
        onOpenChange={setOpen}
        className="limitless-calculator"
        defaultPosition={{ x: Math.max(16, window.innerWidth - 380), y: 96 }}
      />
    </>
  )
}
