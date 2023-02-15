import { useEffect, useState } from "react";
import { Box, Card, Flex, useColorMode } from "theme-ui";
import { useTvl } from "./context/ChartContext";
import { TimestampsObject, tvlData } from "./context/ChartProvider";

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
  ScriptableContext,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Decimal } from "@liquity/lib-base";
import { useHover } from "../../../utils/hooks";
import { LoadingChart } from "./LoadingChart";

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
    if (chart?.tooltip?._active && chart?.tooltip?._active.length) {
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

export const LineChart = (): JSX.Element => {
  const [isMounted, setIsMounted] = useState<boolean>(true);
  const [hoverRef, isHovered] = useHover<HTMLDivElement>();
  const [colorMode] = useColorMode();
  const [activeData, setActiveData] = useState<number | string>('-');
  const [tvl, setTvl] = useState<{ [key: string]: tvlData[]; }>({});
  const [loadedChart, setLoadedChart] = useState<boolean>(false);
  const [timestamps, setTimestamps] = useState<Array<TimestampsObject>>([]);
  const [activeLabel, setActiveLabel] = useState<string>('-');
  const [chartData, setChartData] = useState<Array<Decimal>>([]);
  const [lastTvl, setLastTvl] = useState<Decimal>();
  const [chartLabels, setChartLabels] = useState<Array<TimestampsObject>>();

  useTvl()
    .then((result) => {
      if (result === null || !isMounted) {
        return
      }
      setTvl(result.tvl)
      setTimestamps(result.timestamps)
      setLoadedChart(true)
    })
    .catch((error) => {
      setLoadedChart(false)
      console.error('tvl fetch error: ', error)
    })

  useEffect(() => {
    if (!isMounted || !loadedChart) {
      return
    }
    let historicalTvl: Decimal[] = []
    for (const [version] of Object.entries(tvl)) {
      tvl[version].forEach((versionedTvl, index) => {
        if (historicalTvl[index] === undefined) {
          historicalTvl[index] = Decimal.from(0)
        }
        historicalTvl[index] = versionedTvl.totalCollateral.add(historicalTvl[index])
      });
    }
    setChartLabels(timestamps)
    setChartData(historicalTvl)
    setLastTvl(historicalTvl[historicalTvl.length - 1])

    return () => { 
      setIsMounted(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, loadedChart])

  const labels: Array<{[date: string]: string}> = [];

  chartLabels?.map((timestamp: TimestampsObject) => {
    const date = new Date(timestamp.localTimestamp * 1000) // convert timestamp to date;
    const day = date.getUTCDate();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getUTCFullYear();

    return labels.push({[day]: `${month} ${day}, ${year}`})
  });  

  const options = {
    locale: 'en-US',
    borderWidth: 2,
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      point:{
        radius: 0,
      },
    },
    scales: {
      y: {
        display: false,
        drawTicks: false,
        beginAtZero: true,
      }, 
      x: {
        ticks: {
          padding: 12,
          autoSkip: true,
          maxTicksLimit: 20,
          font: {
            size: 11,
            weight: 'bold'
          }
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
      const activeData = chart.data?.datasets[setIndex] && 
      Decimal.from(chart.data?.datasets[setIndex]?.data[index]).prettify(2);
      const labelIndex = labels[index];
      const activeLabel = labelIndex && Object.values(labelIndex)[0];
      setActiveData(activeData ? activeData : '-');
      setActiveLabel(activeLabel ?? '-')
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
        data: chartData.map(decimal => parseInt(decimal.toString())),
        borderColor: colorMode === "dark" ? "#7d00ff" : colorMode === "darkGrey" ? "#f3f3f3b8" : "#20cb9d",
        pointBackgroundColor: colorMode === 'dark' ? "#7d00ff" : colorMode === "darkGrey" ? "#f3f3f3b8" : "#20cb9d",
        backgroundColor: (context: ScriptableContext<"line">) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 200);
          gradient.addColorStop(0, colorMode === "dark" ? "#7c00fd8c" : colorMode === "darkGrey" ? "#e5e5e5b8" : "#28c39b40");
          gradient.addColorStop(1, colorMode === "dark" ? "#7d00ff00" : colorMode === "darkGrey" ? "#f3f3f321" :  "#ffffff40");
          return gradient;
        },
      },
    ],
  };
  return (
    <Card variant="layout.columns">
      <Flex sx={{
        width: "100%",
        gap: 1,
        pb: 3,
        borderBottom: 1, 
        borderColor: "border"
      }}>
        TVL Chart
      </Flex>
      <Flex sx={{
        width: "100%",
        flexDirection: "column",
        pt: "1em",
        pl: ["1em", 0, 0, "1em"],
        gap: "1em",
      }}>
        <Box style={{
          height: "18.5em",
          marginTop: "2.5em",
          paddingBottom: "2.5em"
        }}>
          <Flex sx={{ 
            position: "absolute", 
            marginTop: "-1.6em",
            fontSize: "1.6em", 
            fontWeight: "bold", 
            color: "text"
          }}>
            {(lastTvl || (isHovered && activeData > 0)) && '$'}
            {loadedChart && (
              isHovered 
              ? activeData 
              : lastTvl 
                ? lastTvl.prettify(2) 
                : '-'
            )} 
          </Flex>
          <Flex sx={{ 
            fontSize: ".9em",
            marginBottom: "1.5em",
            height: "1em",
          }}>
            {loadedChart && isHovered && activeLabel}
          </Flex>
          <Box sx={{ display: "flex", height: "100%", width: "100%" }} ref={hoverRef}>
            {
              !loadedChart 
                ? <LoadingChart />
                : <Line options={{ ...options, interaction: { mode: 'index', intersect: false } }}  data={data} />
            }
          </Box>
        </Box>
      </Flex>
    </Card>
  );
};
