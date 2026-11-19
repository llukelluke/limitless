import { useEffect, useRef } from 'react'
// Only the parts of Apache ECharts the charts need, so the rest stays out of the bundle.
import * as echarts from 'echarts/core'
import { BarChart, GaugeChart } from 'echarts/charts'
import { GridComponent, MarkAreaComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { formatRatio, gauge } from '../ratios.js'

echarts.use([GaugeChart, BarChart, GridComponent, MarkAreaComponent, CanvasRenderer])

// Same greens, yellows and reds as the ratio cards.
const COLORS = { good: '#3f9b5a', warning: '#e3b23c', bad: '#d6544a' }
const TONE = { GOOD: 'good', WARNING: 'warning', BAD: 'bad' }
const INK = '#18213a'
const hidden = { axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, title: { show: false }, detail: { show: false } }

// gauge: half dial with red / yellow / green bands and a needle that sweeps to the value.
// bar: a bar that grows to the value over the same bands. ring: a ring that fills in the ratio's status color.
function chartOption(type, ratio) {
  const { max, stops, value } = gauge(ratio)
  const color = COLORS[TONE[ratio.status]] ?? INK
  if (type === 'bar') {
    let from = 0
    const bands = stops.map(([at, tone]) => {
      const band = [{ xAxis: from, itemStyle: { color: COLORS[tone], opacity: 0.25 } }, { xAxis: at * max }]
      from = at * max
      return band
    })
    return {
      grid: { left: 6, right: 6, top: 30, bottom: 30 },
      xAxis: { type: 'value', min: 0, max, show: false },
      yAxis: { type: 'category', data: [''], show: false },
      series: [{ type: 'bar', data: [value], barWidth: 18, itemStyle: { color, borderRadius: 4 }, markArea: { silent: true, data: bands } }],
    }
  }
  if (type === 'ring') {
    return {
      series: [{
        type: 'gauge', min: 0, max, startAngle: 90, endAngle: -270, radius: '90%', center: ['50%', '50%'],
        pointer: { show: false }, progress: { show: true, roundCap: true, width: 10, itemStyle: { color } },
        axisLine: { lineStyle: { width: 10, color: [[1, '#e5e7eb']] } }, ...hidden, data: [{ value }],
      }],
    }
  }
  return {
    series: [{
      type: 'gauge', min: 0, max, startAngle: 200, endAngle: -20, radius: '100%', center: ['50%', '75%'],
      axisLine: { lineStyle: { width: 10, color: stops.map(([at, tone]) => [at, COLORS[tone]]) } },
      pointer: { width: 4, length: '70%', itemStyle: { color: INK } }, anchor: { show: true, size: 8, itemStyle: { color: INK } },
      ...hidden, data: [{ value }],
    }],
  }
}

// Animated ratio chart (Apache ECharts). type: gauge | bar | ring.
export default function RatioChart({ ratio, type = 'gauge' }) {
  const ref = useRef(null)

  useEffect(() => {
    const chart = echarts.init(ref.current)
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    chart.setOption({ animation: !reduceMotion, animationDuration: 1200, animationEasing: 'cubicOut', ...chartOption(type, ratio) })
    // The observer also fires once on attach; resizing then would skip the animation, so only resize on a real change.
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (Math.round(width) !== chart.getWidth() || Math.round(height) !== chart.getHeight()) chart.resize()
    })
    resize.observe(ref.current)
    return () => {
      resize.disconnect()
      chart.dispose()
    }
  }, [ratio, type])

  // The canvas is decorative: the value and its status are written out on the card.
  return <div ref={ref} className={`ratio-chart ratio-chart--${type}`} data-chart={type} role="img" aria-label={`${ratio.name}: ${formatRatio(ratio)}`} />
}
