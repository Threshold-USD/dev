import { Card } from "theme-ui";

import { LineChart } from "./LineChart";

type ChartCardProps = {
  variant?: string;
};

export const Chart = ({ variant = "mainCards" }: ChartCardProps): JSX.Element => {
  return (
    <Card {...{ variant }} sx={{ width: "100%" }}>
      <LineChart />
    </Card>
  );
};
