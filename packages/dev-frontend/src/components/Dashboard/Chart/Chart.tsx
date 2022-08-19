import React from "react";
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
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export const options = {
  responsive: true,
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: false,
      text: 'Chart.js Line Chart',
    },
  },
};

export const Chart: React.FC = () => { 

  const { tvl, timestamps } = useTvl();
  const labels = timestamps;
  
  const data = {
    labels: labels.map((label) => {
      return label = '';
    }),
    datasets: [
      {
        label: 'Dataset 1',
        data: tvl.map((tvl) => tvl),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
    ],
  };
  return (
    <Box>
      <Line options={options} data={data} />
    </Box>
  );
};
