import React, { useState } from "react";
import { Text, Flex, Label, Input, SxProp, Button, ThemeUICSSProperties } from "theme-ui";

import { Icon } from "../Icon";

type RowProps = SxProp & {
  label: string;
  labelId?: string;
  labelFor?: string;
  infoIcon?: React.ReactNode;
  children?: React.ReactNode;
};

export const Row = ({ sx, label, labelId, labelFor, infoIcon, children }: RowProps): JSX.Element => {
  return (
    <Flex sx={{ alignItems: "start", flexDirection: "column" }}>
      <Label
        id={labelId}
        htmlFor={labelFor}
        sx={{
          p: 0,
          pt: "12px",
          
          fontSize: 1,
          border: 1,
          borderColor: "transparent",
          ...sx
        }}
      >
        <Flex sx={{ alignItems: "start", gap: 1 }}>
          {label}
          {infoIcon && infoIcon}
        </Flex>
      </Label>
      {children}
    </Flex>
  );
};

type PendingAmountProps = {
  value: string;
};

const PendingAmount = ({ sx, value }: PendingAmountProps & SxProp): JSX.Element => (
  <Text {...{ sx }}>
    (
    {value === "++" ? (
      <Icon name="angle-double-up" />
    ) : value === "--" ? (
      <Icon name="angle-double-down" />
    ) : value?.startsWith("+") ? (
      <>
        <Icon name="angle-up" /> {value.substr(1)}
      </>
    ) : value?.startsWith("-") ? (
      <>
        <Icon name="angle-down" /> {value.substr(1)}
      </>
    ) : (
      value
    )}
    )
  </Text>
);

type StaticAmountsProps = {
  inputId: string;
  labelledBy?: string;
  amount: string;
  unit?: string;
  color?: string;
  pendingAmount?: string;
  pendingColor?: string;
  onClick?: () => void;
  children?: React.ReactNode;
};

export const StaticAmounts = ({
  sx,
  inputId,
  labelledBy,
  amount,
  unit,
  pendingAmount,
  pendingColor,
  onClick,
  children
}: StaticAmountsProps & SxProp): JSX.Element => {
  return (
    <Flex
      id={inputId}
      aria-labelledby={labelledBy}
      {...{ onClick }}
      sx={{
        justifyContent: "space-between",
        alignItems: "start",

        ...(onClick ? { cursor: "text" } : {}),

        ...staticStyle,
        ...sx
      }}
    >
      <Flex sx={{ alignItems: "center" }}>
        <Text sx={{ color: "inputText", fontWeight: "semibold" }}>{amount}</Text>

        {unit && (
          <>
            &nbsp;
            <Text sx={{ color: "text",fontWeight: "light" }}>{unit}</Text>
          </>
        )}

        {pendingAmount && (
          <>
            &nbsp;
            <PendingAmount
              sx={{ color: pendingColor, opacity: 0.8, fontSize: "0.666em" }}
              value={pendingAmount}
            />
          </>
        )}
      </Flex>
      {children}
    </Flex>
  );
};

const staticStyle: ThemeUICSSProperties = {
  flexGrow: 1,

  mb: 0,
  pr: "11px",
  pb: 0,

  fontSize: 3,

  border: 1,
  borderColor: "transparent"
};

const editableStyle: ThemeUICSSProperties = {
  backgroundColor: "terciary",

  px: "1.1em",
  py: "0.45em",
  border: 1,
  borderColor: "border",
  borderRadius: 12,
  width: "100%",

  flexGrow: 1,

  mb: [2, 3],
  pl: 3,

  fontSize: 3,
};

type StaticRowProps = RowProps & StaticAmountsProps;

export const StaticRow = ({
  label,
  labelId,
  labelFor,
  infoIcon,
  ...props
}: StaticRowProps): JSX.Element => (
  <Row {...{ label, labelId, labelFor, infoIcon }} sx={{ fontSize: "0.9em", color: "text", fontWeight: "bold", mt: 3 }}>
    <StaticAmounts {...props} />
  </Row>
);

type DisabledEditableRowProps = Omit<StaticAmountsProps, "labelledBy" | "onClick"> & {
  label: string;
};

export const DisabledEditableRow = ({
  inputId,
  label,
  unit,
  amount,
  color,
  pendingAmount,
  pendingColor
}: DisabledEditableRowProps): JSX.Element => (
  <Row labelId={`${inputId}-label`} {...{ label, unit }}>
    <StaticAmounts
      sx={{ ...editableStyle, boxShadow: 0 }}
      labelledBy={`${inputId}-label`}
      {...{ inputId, amount, unit, color, pendingAmount, pendingColor }}
    />
  </Row>
);

type EditableRowProps = DisabledEditableRowProps & {
  editingState: [string | undefined, (editing: string | undefined) => void];
  editedAmount: string;
  setEditedAmount: (editedAmount: string) => void;
  maxAmount?: string;
  maxedOut?: boolean;
  infoIcon?: React.ReactNode;
};

export const EditableRow = ({
  label,
  inputId,
  unit,
  amount,
  color,
  pendingAmount,
  pendingColor,
  editingState,
  editedAmount,
  setEditedAmount,
  maxAmount,
  maxedOut,
  infoIcon
}: EditableRowProps): JSX.Element => {
  const [editing, setEditing] = editingState;
  const [invalid, setInvalid] = useState(false);

  return editing === inputId ? (
    <Flex sx={{ flexDirection: "column", flexWrap: "wrap", }}>
      <Row {...{ label, labelFor: inputId, unit, infoIcon }} />
      <Input
        id={inputId}
        type="number"
        step="any"
        defaultValue={editedAmount}
        {...{ invalid }}
        onChange={e => {
          try {
            setEditedAmount(e.target.value);
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
        onWheel={e => {
          setEditing(undefined);
        }}
        onBlur={() => {
          setEditing(undefined);
          setInvalid(false);
        }}
        variant="layout.balanceRow"
        sx={{
          ...editableStyle,
          fontWeight: "medium"
        }}
      />
  </Flex>
  ) : (
    <Flex sx={{ flexDirection: "column", flexWrap: "wrap", }}>
      <Row labelId={`${inputId}-label`} {...{ label, unit, infoIcon }} />
      <StaticAmounts
        sx={{
          ...editableStyle,
        }}
        labelledBy={`${inputId}-label`}
        onClick={() => setEditing(inputId)}
        {...{ inputId, amount, unit, color, pendingAmount, pendingColor, invalid }}
      >
        {maxAmount && (
          <Button
            sx={{ fontSize: 1, p: 1, px: 3 }}
            onClick={event => {
              setEditedAmount(maxAmount);
              event.stopPropagation();
            }}
            disabled={maxedOut}
          >
            max
          </Button>
        )}
      </StaticAmounts>
    </Flex>
  );
};
