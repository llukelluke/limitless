import { useEffect, useRef } from 'react'
// Only the parts of Apache ECharts the gauge needs, so the rest stays out of the bundle.
import * as echarts from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { formatRatio, gauge } from '../ratios.js'

echarts.use([GaugeChart, CanvasRenderer])

// Same greens, yellows and reds as the ratio cards.
const COLORS = { good: '#3f9b5a', warning: '#e3b23c', bad: '#d6544a' }

// Animated half-dial gauge: red / yellow / green bands, and a needle that sweeps up to the ratio's value.
export default function RatioGauge({ ratio }) {
  const ref = useRef(null)

  useEffect(() => {
    const chart = echarts.init(ref.current)
    const { max, stops, value } = gauge(ratio)
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    chart.setOption({
      animation: !reduceMotion,
      animationDuration: 1200,
      animationEasing: 'cubicOut',
      series: [
        {
          type: 'gauge',
          min: 0,
          max,
          startAngle: 200,
          endAngle: -20,
          radius: '100%',
          center: ['50%', '75%'],
          axisLine: { lineStyle: { width: 10, color: stops.map(([at, tone]) => [at, COLORS[tone]]) } },
          pointer: { width: 4, length: '70%', itemStyle: { color: '#18213a' } },
          anchor: { show: true, size: 8, itemStyle: { color: '#18213a' } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: { show: false },
          detail: { show: false },
          data: [{ value }],
        },
      ],
    })
    const resize = new ResizeObserver(() => chart.resize())
    resize.observe(ref.current)
    return () => {
      resize.disconnect()
      chart.dispose()
    }
  }, [ratio])

  // The canvas is decorative: the value and its status are written out on the card.
  return <div ref={ref} className="ratio-gauge" role="img" aria-label={`${ratio.name}: ${formatRatio(ratio)}`} />
}
