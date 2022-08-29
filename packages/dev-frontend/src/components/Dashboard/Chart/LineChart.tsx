import React, { useState } from "react";
import { Box } from "theme-ui";

import { useTvl } from "./context/ChartContext";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ScriptableContext
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

ChartJS.register({
  id: 'uniqueid',
  beforeDraw: function (chart: any, _easing: any) {
    if (chart.tooltip._active && chart.tooltip._active.length) {
      const ctx = chart.ctx;
      const activePoint = chart.tooltip._active[0];
      const x = activePoint.element.x;
      const topY = chart.scales.y.top;
      const bottomY = chart.scales.y.bottom;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#e1e1e1';
      ctx.stroke();
      ctx.restore();
    }
  }
});

export const LineChart: React.FC = () => { 

  const [activeData, setActiveData] = useState<number | string>('-');
  const [activeLabel, setActiveLabel] = useState<string>();
  const { tvl, timestamps } = useTvl();

  const labels: Array<{[date: string]: string}> = [];

  timestamps.map((label: number) => {
    const date = new Date(label * 1000) // convert timestamp to date;
    const day = date.getUTCDate();
    const month = date.toLocaleString('default', { month: 'long' })
    const year = date.getUTCFullYear();

    return labels.push({[day]: `${month} ${day}, ${year}`})
  });

  const options = {
    responsive: true,
    elements: {
      point:{
          radius: 0,
      },
    },
    scales: {
      y: {
        display: false,
        drawTicks: false,
      }, 
      x: {
        ticks: {
          padding: 15,
        },
        grid: {
          display: false,
          drawBorder: false,
          drawTicks: false,
        },
      },
    },
    grid: {
      display: false,
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false,
      },
      title: {
        display: false,
      },
    },
    onHover: (event: any) => {
      const chart = event.chart
      const activePoint = chart.tooltip._active[0];
      const setIndex = activePoint?.datasetIndex;
      const index = activePoint?.index;
      const activeData = chart.data?.datasets[setIndex]?.data[index];
      const labelIndex = labels[index];
      const activeLabel = labelIndex && Object.values(labelIndex)[0];
      setActiveData(activeData ? activeData : '-');
      console.log('labelIndex: ', labelIndex);
      setActiveLabel(activeLabel && activeLabel)
    }
  };
  
  const data = {
    labels: labels.map((label: {[day: string]: string}) => {
      return Object.keys(label)
    }),
    datasets: [
      {
        fill: "start",
        lineTension: 0.4,
        label: 'TVL',
        data: tvl.map((tvl) => {
          return tvl.totalCollateral
        }),
        borderColor: '#20cb9d',
        pointBackgroundColor: '#20cb9d',
        backgroundColor: (context: ScriptableContext<"line">) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 200);
          gradient.addColorStop(0, "#28c39b40");
          gradient.addColorStop(1, "#ffffff40");
          return gradient;
        },
      },
    ],
  };
  return (
    <Box>
      <Box>{activeData} {activeData > 0 && ' WETH'}</Box>
      <Box style={{ position: "absolute" }}>{activeLabel}</Box>
      <Line options={{
        ...options,
        interaction: {
          mode: 'index',
          intersect: false,
        }
      }}  data={data} />
    </Box>
  );
};
