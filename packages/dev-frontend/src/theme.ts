import { Theme, ThemeUIStyleObject } from "theme-ui";

const baseColors = {
  white: "#FFF",
  blue: "#1542cd",
  purple: "#7C08F9",
  cyan: "#E2F2FF",
  green: "#28c081",
  yellow: "#fd9d28",
  red: "#dc2c10",
  lightRed: "#ff755f",
  lightgrey: "#e8eef3",
  grey: "#6A7793",
  lightBlue: "#F6F7FA",
};

const buttonBase: ThemeUIStyleObject = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  ":enabled": { cursor: "pointer" }
};

const button: ThemeUIStyleObject = {
  ...buttonBase,

  px: "32px",
  py: "12px",

  color: "white",
  border: 1,

  fontWeight: "bold",

  ":disabled": {
    opacity: 0.5
  }
};

const buttonOutline = (color: string, hoverColor: string): ThemeUIStyleObject => ({
  color,
  borderColor: color,
  background: "none",

  ":enabled:hover": {
    color: "background",
    bg: hoverColor,
    borderColor: hoverColor
  }
});

const iconButton: ThemeUIStyleObject = {
  ...buttonBase,

  padding: 0,
  width: "40px",
  height: "40px",
  stroke: "#000",
  ":hover": {
    stroke: "#7C08F9",
  },

  background: "none",

  ":disabled": {
    color: "text",
    opacity: 0.25
  }
};

const cardHeadingFontSize = 18.7167;

const cardGapX = [0, 3, 4];
const cardGapY = [3, 3, 4];

const card: ThemeUIStyleObject = {
  position: "relative",
  mt: cardGapY,
  borderRadius: "12px",
  boxShadow: [1, null, 1]
};

const infoCard: ThemeUIStyleObject = {
  ...card,

  color: "text",
  fontWeight: "medium",
  px: "2.5em",
  py: "1.5em",
  borderRadius: "12px",
  bg: "background",
};

const formBase: ThemeUIStyleObject = {
  display: "block",
  width: "auto",
  flexShrink: 0,
  padding: 2,
  fontSize: 3
};

const formCell: ThemeUIStyleObject = {
  ...formBase,

  bg: "background",
  border: 1,
  borderColor: "muted",
  borderRadius: 0,
  boxShadow: [1, 2]
};

const overlay: ThemeUIStyleObject = {
  position: "absolute",

  left: 0,
  top: 0,
  width: "100%",
  height: "100%"
};

const modalOverlay: ThemeUIStyleObject = {
  position: "fixed",

  left: 0,
  top: 0,
  height: "100vh"
};

const columns: ThemeUIStyleObject = {
  display: "flex",
  flexWrap: "wrap",
  justifyItems: "center",
};

const theme: Theme = {
  initialColorModeName: 'light',

  breakpoints: ["45em", "80em", "120em"],

  space: [0, 4, 8, 16, 32, 64, 128, 256, 512],

  fonts: {
    body: [
      "Roboto",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      '"Helvetica Neue"',
      "sans-serif"
    ].join(", "),
    heading: "inherit",
    monospace: "Menlo, monospace"
  },

  fontSizes: [12, 14, 16, 20, 24, 32, 48, 64, 96],

  fontWeights: {
    body: 400,
    heading: 600,

    light: 200,
    medium: 500,
    bold: 600,
    extrabold: 700,
  },

  lineHeights: {
    body: 1.5,
    heading: 1.25
  },
  
  colors: {
    primary: baseColors.purple,
    secondary: baseColors.blue,
    terciary: baseColors.lightBlue,
    accent: baseColors.cyan,
  
    success: baseColors.green,
    warning: baseColors.yellow,
    danger: baseColors.red,
    dangerHover: baseColors.lightRed,
    info: baseColors.blue,
    border: baseColors.lightgrey,
    greytext: baseColors.grey,
    invalid: "pink",
  
    activeMenu: baseColors.purple,
    menu: "#939393",
    text: "#191d28",
    heading: "#6A7793",
    background: baseColors.white,
    wrapperBackground: "#f7fafca1",
    muted: "#eaebed",
    inputText: "#6A7793",
    metaMaskButtonBg: "#EDF2F7",
    metaMaskInnerButtonBg: "#CBD5E0",  
    modes: {
      dark: {
        primary: "#7D00FF",      
        info: baseColors.red,
        border: "#9974FF23",
        greytext: "#b1bccc",
        
        activeMenu: baseColors.white,
        menu: "#b1bccc",
        text: "#FCF9FF",
        heading: "#9974FF",
        background: "#200c5a",
        muted: "#9974FF23",
        wrapperBackground: "#150640",
        metaMaskButtonBg: "#7D00FF", 
        metaMaskInnerButtonBg: "#200c5a"
      },
      darkGrey: {
        primary: "#4A5568",
        info: baseColors.red,
        border: "#72727223",
        greytext: "#B1BCCC",
        
        activeMenu: "#F6F7FA",
        menu: "#b1bccc",
        text: "#F6F7FA",
        heading: "#F6F7FA",
        background: "#323A47",
        muted: "#9974FF23",
        wrapperBackground: "#1D2229",
        metaMaskButtonBg: "#4A5568", 
        metaMaskInnerButtonBg: "#323A47"
      },
    }
  },



  borders: [0, "1px solid", "2px solid"],

  shadows: ["0", "0px 4px 8px rgba(41, 49, 71, 0.1)", "0px 8px 16px rgba(41, 49, 71, 0.1)"],

  text: {
    address: {
      fontFamily: "monospace",
      fontSize: 1
    }
  },

  buttons: {
    primary: {
      ...button,

      bg: "primary",
      borderColor: "primary",
      borderRadius: "12px"
    },

    outline: {
      ...button,
      ...buttonOutline("primary", "primary")
    },

    cancel: {
      ...button,
      ...buttonOutline("primary", "primary"),
    },

    danger: {
      ...button,

      bg: "danger",
      borderColor: "danger",
      borderRadius: 12,

      ":enabled:hover": {
        bg: "dangerHover",
        borderColor: "dangerHover"
      }
    },

    icon: {
      ...iconButton,
      color: "primary",
    },

    dangerIcon: {
      ...iconButton,
      color: "danger",
      ":enabled:hover": { color: "dangerHover" }
    },

    titleIcon: {
      ...iconButton,
      color: "text",
      ":enabled:hover": { color: "success" }
    }
  },

  cards: {
    primary: {
      ...card,

      padding: 0,

      borderColor: "muted",
      bg: "background",

      "> h2": {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",

        height: "56px",

        pl: 3,
        py: 2,
        pr: 2,

        bg: "muted",

        fontSize: cardHeadingFontSize
      }
    },

    info: {
      ...infoCard,

      display: "block",
      fontSize: "0.9em"
    },

    mainCards: {
      ...card,
      color: "heading",
      fontWeight: "medium",
      fontSize: "0.9em",
      px: ["0.5em", "2em"],
      py: "1.5em",
      backgroundColor: "background",
      borderRadius: "12px",
    },

    infoPopup: {
      ...infoCard,

      position: "fixed",
      top: 0,
      right: 3,
      left: 3,
      mt: "72px",
      height: "80%",
      overflowY: "scroll",
      bg: "white"
    },

    tooltip: {
      padding: 2,

      border: 1,
      borderColor: "muted",
      borderRadius: "4px",
      bg: "background",
      boxShadow: 2,

      fontSize: 1,
      color: "heading",
      fontWeight: "body",
      zIndex: 1
    }
  },

  forms: {
    label: {
      ...formBase
    },

    unit: {
      ...formCell,

      textAlign: "center",
      bg: "muted"
    },

    input: {
      ...formCell,

      flex: 1
    },

    editor: {}
  },

  layout: {

    userAccount: {
      display: "flex",
      alignItems: "center", 
      bg: "black",
      px: "1em",
      py: ".5em",
      gap: "1em",
      backgroundColor: "metaMaskButtonBg",
      borderRadius: ".5em"
    },
    
    account: {
      display: "flex",
      px: "1em",
      py: ".1em", 
      bg:"white", 
      justifyContent: "center",
      backgroundColor: "metaMaskInnerButtonBg",
      borderRadius: ".4em"
    },

    balanceRow: {
      color: "inputText",
      justifyContent: "start",
      alignItems: "center",
      backgroundColor: "terciary",
      gap: "0.9em",

      px: "1.1em",
      py: "0.5em",
      border: 1,
      borderColor: "border",
      borderRadius: 12,
    },

    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "stretch",

      position: "fixed",
      width: "100vw",
      top: 0,
      zIndex: 1,

      px: ["1.5em", "2.5em"],
      py: "19px",

      borderBottom: 1,
      borderColor: "border",
      bg: "background",
    },

    sideBar: {
      display: ["none", "flex"],
      justifyContent: "space-between",
      alignItems: "stretch",

      position: "fixed",
      height: "100%",
      width: [0, "15em", "19em"],
      top: 0,
      zIndex: 0,
      borderRight: 1,
      borderColor: "border",
      bg: "background",
      pt: "7em",
    },

    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      mt: cardGapY,
      px: 3,
      minHeight: "72px",

      bg: "muted"
    },

    wrapper: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100%",
      backgroundColor: "wrapperBackground"
    },

    main: {
      display: "flex",
      alignItems: "center",
      width: "100%",
      maxWidth: ["728px","1640px"],
      mx: ["auto"],
      mt: ["100px", "100px", "80px"],
      mb: ["40px", "100px"],
      pl: [0, "17.5em", "22em"],
      px: ["1.5em",]
    },

    columns: {
      ...columns
    },

    pageRow: {
      ...columns,

      flexDirection: "row",
      mt: 1
    },

    singlePage: {
      maxWidth: "980px"
    },

    dashboardGrid: {
      ...columns,

      flexDirection: ["column-reverse", "row"]
    },

    oneThird: {
      pr: cardGapX,
      width: ["100%", "100%", "33%"]
    },

    half: {
      pr: cardGapX,
      width: ["100%", "50%", "50%"]
    },

    twoThirds: {
      pr: cardGapX,
      width: ["100%", "100%", "67%"]
    },

    firstHalf: {
      pr: [0, "1em", "2.5em"],
      width: ["100%", "100%", "50%"]
    },

    secondHalf: {
      pr: cardGapX,
      width: ["100%", "100%", "50%"]
    },

    actions: {
      width: "100%",
      justifyContent: "center",
      mt: "1.5em",

      button: {
        ml: 2
      }
    },

    disabledOverlay: {
      ...overlay,

      bg: "rgba(255, 255, 255, 0.5)"
    },

    modalOverlay: {
      ...modalOverlay,

      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    },

    modal: {
      padding: 3,
      width: ["100%", "40em"]
    },

    infoOverlay: {
      ...modalOverlay,

      display: ["block", "none"],
    },

    infoMessage: {
      display: "flex",
      justifyContent: "center",
      m: 3,
      alignItems: "center",
      minWidth: "128px"
    },

    sidenav: {
      display: "flex",
      mt: "5em",
      pt: "1em",
      height: "100%",
      width: "17em",
      position: "absolute",
      borderLeft: 1,
      borderColor: "border",
      bg: "white",
      right: 0,
    },

    badge: {
      border: 0,
      borderRadius: 3,
      p: 1,
      px: 2,
      backgroundColor: "muted",
      color: "slate",
      fontSize: 1,
      fontWeight: "body"
    },

  },

  styles: {
    root: {
      position: "relative",

      fontFamily: "body",
      lineHeight: "body",
      fontWeight: "body",

      width: "100%",
      height: "100%",

      "#root": {
        height: "100%"
      }
    },

    a: {
      color: "primary",
      ":hover": { color: "accent" },
      textDecoration: "none",
      fontWeight: "bold",
    },
  },

  links: {
    nav: {
      display: "flex",
      alignItems: "center", 
      mb: 3,
      px: 2,
      py: 1,
      pl: "3em",
      fontWeight: "semibold",
      fontSize: ".9rem",
      textTransform: "capitalize",
      mt: [3],
      color: "menu",
      gap: "1em",
      textDecoration: "none",
      ":hover, :enabled, &.active": {
        color: "activeMenu",
      },
    },
    socialIcons: {
      display: "flex",
      mx: 3,
      mt: 4,
      mb: ["6em", "2em"],
      color: "primary",
      ":hover, :enabled": {
        color: "primary",
      },
    },
    cardLinks: {
      display: "flex",
      mr: 1,
      pb: 3,
      color: "primary",
      ":hover, :enabled": {
        color: "primary",
      },
    },
    infoLink: {
      textDecoration: "none",
      color: "primary",
      fontWeight: "medium",
    },
    logo: {
      display: "flex",
      alignItems: "center",
      fontSize: "0.87rem", 
      fontWeight: "extrabold",
      letterSpacing: -0.7,
    },
  }
};

export default theme;
