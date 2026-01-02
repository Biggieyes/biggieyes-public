const BLOCK_IMAGES = {
  ORANGE: [
    "Biggi_1_ORANGE_O.png","Biggi_1_ORANGE_B.png","Biggi_1_ORANGE_W.png","Biggi_1_ORANGE_BR.png","Biggi_1_ORANGE_BL.png","Biggi_1_ORANGE_G.png","Biggi_1_ORANGE_V.png","Biggi_1_ORANGE_R.png","Biggi_1_ORANGE_P.png","Biggi_1_ORANGE_RB.png",
    "Biggi_2_ORANGE_O.png","Biggi_2_ORANGE_B.png","Biggi_2_ORANGE_W.png","Biggi_2_ORANGE_BR.png","Biggi_2_ORANGE_BL.png","Biggi_2_ORANGE_G.png","Biggi_2_ORANGE_V.png","Biggi_2_ORANGE_R.png","Biggi_2_ORANGE_P.png","Biggi_2_ORANGE_RB.png",
    "Biggi_3_ORANGE_O.png","Biggi_3_ORANGE_B.png","Biggi_3_ORANGE_W.png","Biggi_3_ORANGE_BR.png","Biggi_3_ORANGE_BL.png","Biggi_3_ORANGE_G.png","Biggi_3_ORANGE_V.png","Biggi_3_ORANGE_R.png","Biggi_3_ORANGE_P.png","Biggi_3_ORANGE_RB.png",
    "Biggi_4_ORANGE_O.png","Biggi_4_ORANGE_B.png","Biggi_4_ORANGE_W.png","Biggi_4_ORANGE_BR.png","Biggi_4_ORANGE_BL.png","Biggi_4_ORANGE_G.png","Biggi_4_ORANGE_V.png","Biggi_4_ORANGE_R.png","Biggi_4_ORANGE_P.png","Biggi_4_ORANGE_RB.png",
    "Biggi_5_ORANGE_O.png","Biggi_5_ORANGE_B.png","Biggi_5_ORANGE_W.png","Biggi_5_ORANGE_BR.png","Biggi_5_ORANGE_BL.png","Biggi_5_ORANGE_G.png","Biggi_5_ORANGE_V.png","Biggi_5_ORANGE_R.png","Biggi_5_ORANGE_P.png","Biggi_5_ORANGE_RB.png",
    "Biggi_6_ORANGE_O.png","Biggi_6_ORANGE_B.png","Biggi_6_ORANGE_W.png","Biggi_6_ORANGE_BR.png","Biggi_6_ORANGE_BL.png","Biggi_6_ORANGE_G.png","Biggi_6_ORANGE_V.png","Biggi_6_ORANGE_R.png","Biggi_6_ORANGE_P.png","Biggi_6_ORANGE_RB.png",
    "Biggi_7_ORANGE_O.png","Biggi_7_ORANGE_B.png","Biggi_7_ORANGE_W.png","Biggi_7_ORANGE_BR.png","Biggi_7_ORANGE_BL.png","Biggi_7_ORANGE_G.png","Biggi_7_ORANGE_V.png","Biggi_7_ORANGE_R.png","Biggi_7_ORANGE_P.png","Biggi_7_ORANGE_RB.png",
    "Biggi_8_ORANGE_O.png","Biggi_8_ORANGE_B.png","Biggi_8_ORANGE_W.png","Biggi_8_ORANGE_BR.png","Biggi_8_ORANGE_BL.png","Biggi_8_ORANGE_G.png","Biggi_8_ORANGE_V.png","Biggi_8_ORANGE_R.png","Biggi_8_ORANGE_P.png","Biggi_8_ORANGE_RB.png",
    "Biggi_9_ORANGE_O.png","Biggi_9_ORANGE_B.png","Biggi_9_ORANGE_W.png","Biggi_9_ORANGE_BR.png","Biggi_9_ORANGE_BL.png","Biggi_9_ORANGE_G.png","Biggi_9_ORANGE_V.png","Biggi_9_ORANGE_R.png","Biggi_9_ORANGE_P.png","Biggi_9_ORANGE_RB.png",
    "Biggi_10_ORANGE_O.png","Biggi_10_ORANGE_B.png","Biggi_10_ORANGE_W.png","Biggi_10_ORANGE_BR.png","Biggi_10_ORANGE_BL.png","Biggi_10_ORANGE_G.png","Biggi_10_ORANGE_V.png","Biggi_10_ORANGE_R.png","Biggi_10_ORANGE_P.png","Biggi_10_ORANGE_RB.png"
  ],
  BLACK: [
    "Biggi_11_BLACK_O.png","Biggi_11_BLACK_B.png","Biggi_11_BLACK_W.png","Biggi_11_BLACK_BR.png","Biggi_11_BLACK_BL.png","Biggi_11_BLACK_G.png","Biggi_11_BLACK_V.png","Biggi_11_BLACK_R.png","Biggi_11_BLACK_P.png",
    "Biggi_12_BLACK_O.png","Biggi_12_BLACK_B.png","Biggi_12_BLACK_W.png","Biggi_12_BLACK_BR.png","Biggi_12_BLACK_BL.png","Biggi_12_BLACK_G.png","Biggi_12_BLACK_V.png","Biggi_12_BLACK_R.png","Biggi_12_BLACK_P.png",
    "Biggi_13_BLACK_O.png","Biggi_13_BLACK_B.png","Biggi_13_BLACK_W.png","Biggi_13_BLACK_BR.png","Biggi_13_BLACK_BL.png","Biggi_13_BLACK_G.png","Biggi_13_BLACK_V.png","Biggi_13_BLACK_R.png","Biggi_13_BLACK_P.png",
    "Biggi_14_BLACK_O.png","Biggi_14_BLACK_B.png","Biggi_14_BLACK_W.png","Biggi_14_BLACK_BR.png","Biggi_14_BLACK_BL.png","Biggi_14_BLACK_G.png","Biggi_14_BLACK_V.png","Biggi_14_BLACK_R.png","Biggi_14_BLACK_P.png",
    "Biggi_15_BLACK_O.png","Biggi_15_BLACK_B.png","Biggi_15_BLACK_W.png","Biggi_15_BLACK_BR.png","Biggi_15_BLACK_BL.png","Biggi_15_BLACK_G.png","Biggi_15_BLACK_V.png","Biggi_15_BLACK_R.png","Biggi_15_BLACK_P.png",
    "Biggi_16_BLACK_O.png","Biggi_16_BLACK_B.png","Biggi_16_BLACK_W.png","Biggi_16_BLACK_BR.png","Biggi_16_BLACK_BL.png","Biggi_16_BLACK_G.png","Biggi_16_BLACK_V.png","Biggi_16_BLACK_R.png","Biggi_16_BLACK_P.png",
    "Biggi_17_BLACK_O.png","Biggi_17_BLACK_B.png","Biggi_17_BLACK_W.png","Biggi_17_BLACK_BR.png","Biggi_17_BLACK_BL.png","Biggi_17_BLACK_G.png","Biggi_17_BLACK_V.png","Biggi_17_BLACK_R.png","Biggi_17_BLACK_P.png",
    "Biggi_18_BLACK_O.png","Biggi_18_BLACK_B.png","Biggi_18_BLACK_W.png","Biggi_18_BLACK_BR.png","Biggi_18_BLACK_BL.png","Biggi_18_BLACK_G.png","Biggi_18_BLACK_V.png","Biggi_18_BLACK_R.png","Biggi_18_BLACK_P.png",
    "Biggi_19_BLACK_O.png","Biggi_19_BLACK_B.png","Biggi_19_BLACK_W.png","Biggi_19_BLACK_BR.png","Biggi_19_BLACK_BL.png","Biggi_19_BLACK_G.png","Biggi_19_BLACK_V.png","Biggi_19_BLACK_R.png","Biggi_19_BLACK_P.png",
    "Biggi_20_BLACK_O.png","Biggi_20_BLACK_B.png","Biggi_20_BLACK_W.png","Biggi_20_BLACK_BR.png","Biggi_20_BLACK_BL.png","Biggi_20_BLACK_G.png","Biggi_20_BLACK_V.png","Biggi_20_BLACK_R.png","Biggi_20_BLACK_P.png"
  ],
  WHITE: [
    "Biggi_21_WHITE_O.png","Biggi_21_WHITE_B.png","Biggi_21_WHITE_W.png","Biggi_21_WHITE_BR.png","Biggi_21_WHITE_BL.png","Biggi_21_WHITE_G.png","Biggi_21_WHITE_V.png","Biggi_21_WHITE_R.png",
    "Biggi_22_WHITE_O.png","Biggi_22_WHITE_B.png","Biggi_22_WHITE_W.png","Biggi_22_WHITE_BR.png","Biggi_22_WHITE_BL.png","Biggi_22_WHITE_G.png","Biggi_22_WHITE_V.png","Biggi_22_WHITE_R.png",
    "Biggi_23_WHITE_O.png","Biggi_23_WHITE_B.png","Biggi_23_WHITE_W.png","Biggi_23_WHITE_BR.png","Biggi_23_WHITE_BL.png","Biggi_23_WHITE_G.png","Biggi_23_WHITE_V.png","Biggi_23_WHITE_R.png",
    "Biggi_24_WHITE_O.png","Biggi_24_WHITE_B.png","Biggi_24_WHITE_W.png","Biggi_24_WHITE_BR.png","Biggi_24_WHITE_BL.png","Biggi_24_WHITE_G.png","Biggi_24_WHITE_V.png","Biggi_24_WHITE_R.png",
    "Biggi_25_WHITE_O.png","Biggi_25_WHITE_B.png","Biggi_25_WHITE_W.png","Biggi_25_WHITE_BR.png","Biggi_25_WHITE_BL.png","Biggi_25_WHITE_G.png","Biggi_25_WHITE_V.png","Biggi_25_WHITE_R.png",
    "Biggi_26_WHITE_O.png","Biggi_26_WHITE_B.png","Biggi_26_WHITE_W.png","Biggi_26_WHITE_BR.png","Biggi_26_WHITE_BL.png","Biggi_26_WHITE_G.png","Biggi_26_WHITE_V.png","Biggi_26_WHITE_R.png",
    "Biggi_27_WHITE_O.png","Biggi_27_WHITE_B.png","Biggi_27_WHITE_W.png","Biggi_27_WHITE_BR.png","Biggi_27_WHITE_BL.png","Biggi_27_WHITE_G.png","Biggi_27_WHITE_V.png","Biggi_27_WHITE_R.png",
    "Biggi_28_WHITE_O.png","Biggi_28_WHITE_B.png","Biggi_28_WHITE_W.png","Biggi_28_WHITE_BR.png","Biggi_28_WHITE_BL.png","Biggi_28_WHITE_G.png","Biggi_28_WHITE_V.png","Biggi_28_WHITE_R.png",
    "Biggi_29_WHITE_O.png","Biggi_29_WHITE_B.png","Biggi_29_WHITE_W.png","Biggi_29_WHITE_BR.png","Biggi_29_WHITE_BL.png","Biggi_29_WHITE_G.png","Biggi_29_WHITE_V.png","Biggi_29_WHITE_R.png",
    "Biggi_30_WHITE_O.png","Biggi_30_WHITE_B.png","Biggi_30_WHITE_W.png","Biggi_30_WHITE_BR.png","Biggi_30_WHITE_BL.png","Biggi_30_WHITE_G.png","Biggi_30_WHITE_V.png","Biggi_30_WHITE_R.png"
  ],
  BROWN: [
    "Biggi_31_BROWN_O.png","Biggi_31_BROWN_B.png","Biggi_31_BROWN_W.png","Biggi_31_BROWN_BR.png","Biggi_31_BROWN_BL.png","Biggi_31_BROWN_G.png","Biggi_31_BROWN_V.png",
    "Biggi_32_BROWN_O.png","Biggi_32_BROWN_B.png","Biggi_32_BROWN_W.png","Biggi_32_BROWN_BR.png","Biggi_32_BROWN_BL.png","Biggi_32_BROWN_G.png","Biggi_32_BROWN_V.png",
    "Biggi_33_BROWN_O.png","Biggi_33_BROWN_B.png","Biggi_33_BROWN_W.png","Biggi_33_BROWN_BR.png","Biggi_33_BROWN_BL.png","Biggi_33_BROWN_G.png","Biggi_33_BROWN_V.png",
    "Biggi_34_BROWN_O.png","Biggi_34_BROWN_B.png","Biggi_34_BROWN_W.png","Biggi_34_BROWN_BR.png","Biggi_34_BROWN_BL.png","Biggi_34_BROWN_G.png","Biggi_34_BROWN_V.png",
    "Biggi_35_BROWN_O.png","Biggi_35_BROWN_B.png","Biggi_35_BROWN_W.png","Biggi_35_BROWN_BR.png","Biggi_35_BROWN_BL.png","Biggi_35_BROWN_G.png","Biggi_35_BROWN_V.png",
    "Biggi_36_BROWN_O.png","Biggi_36_BROWN_B.png","Biggi_36_BROWN_W.png","Biggi_36_BROWN_BR.png","Biggi_36_BROWN_BL.png","Biggi_36_BROWN_G.png","Biggi_36_BROWN_V.png",
    "Biggi_37_BROWN_O.png","Biggi_37_BROWN_B.png","Biggi_37_BROWN_W.png","Biggi_37_BROWN_BR.png","Biggi_37_BROWN_BL.png","Biggi_37_BROWN_G.png","Biggi_37_BROWN_V.png",
    "Biggi_38_BROWN_O.png","Biggi_38_BROWN_B.png","Biggi_38_BROWN_W.png","Biggi_38_BROWN_BR.png","Biggi_38_BROWN_BL.png","Biggi_38_BROWN_G.png","Biggi_38_BROWN_V.png",
    "Biggi_39_BROWN_O.png","Biggi_39_BROWN_B.png","Biggi_39_BROWN_W.png","Biggi_39_BROWN_BR.png","Biggi_39_BROWN_BL.png","Biggi_39_BROWN_G.png","Biggi_39_BROWN_V.png",
    "Biggi_40_BROWN_O.png","Biggi_40_BROWN_B.png","Biggi_40_BROWN_W.png","Biggi_40_BROWN_BR.png","Biggi_40_BROWN_BL.png","Biggi_40_BROWN_G.png","Biggi_40_BROWN_V.png"
  ],
  BLUE: [
    "Biggi_41_BLUE_O.png","Biggi_41_BLUE_B.png","Biggi_41_BLUE_W.png","Biggi_41_BLUE_BR.png","Biggi_41_BLUE_BL.png","Biggi_41_BLUE_G.png",
    "Biggi_42_BLUE_O.png","Biggi_42_BLUE_B.png","Biggi_42_BLUE_W.png","Biggi_42_BLUE_BR.png","Biggi_42_BLUE_BL.png","Biggi_42_BLUE_G.png",
    "Biggi_43_BLUE_O.png","Biggi_43_BLUE_B.png","Biggi_43_BLUE_W.png","Biggi_43_BLUE_BR.png","Biggi_43_BLUE_BL.png","Biggi_43_BLUE_G.png",
    "Biggi_44_BLUE_O.png","Biggi_44_BLUE_B.png","Biggi_44_BLUE_W.png","Biggi_44_BLUE_BR.png","Biggi_44_BLUE_BL.png","Biggi_44_BLUE_G.png",
    "Biggi_45_BLUE_O.png","Biggi_45_BLUE_B.png","Biggi_45_BLUE_W.png","Biggi_45_BLUE_BR.png","Biggi_45_BLUE_BL.png","Biggi_45_BLUE_G.png",
    "Biggi_46_BLUE_O.png","Biggi_46_BLUE_B.png","Biggi_46_BLUE_W.png","Biggi_46_BLUE_BR.png","Biggi_46_BLUE_BL.png","Biggi_46_BLUE_G.png",
    "Biggi_47_BLUE_O.png","Biggi_47_BLUE_B.png","Biggi_47_BLUE_W.png","Biggi_47_BLUE_BR.png","Biggi_47_BLUE_BL.png","Biggi_47_BLUE_G.png",
    "Biggi_48_BLUE_O.png","Biggi_48_BLUE_B.png","Biggi_48_BLUE_W.png","Biggi_48_BLUE_BR.png","Biggi_48_BLUE_BL.png","Biggi_48_BLUE_G.png",
    "Biggi_49_BLUE_O.png","Biggi_49_BLUE_B.png","Biggi_49_BLUE_W.png","Biggi_49_BLUE_BR.png","Biggi_49_BLUE_BL.png","Biggi_49_BLUE_G.png",
    "Biggi_50_BLUE_O.png","Biggi_50_BLUE_B.png","Biggi_50_BLUE_W.png","Biggi_50_BLUE_BR.png","Biggi_50_BLUE_BL.png","Biggi_50_BLUE_G.png"
  ],
  GREEN: [
    "Biggi_51_GREEN_O.png","Biggi_51_GREEN_B.png","Biggi_51_GREEN_W.png","Biggi_51_GREEN_BR.png","Biggi_51_GREEN_BL.png",
    "Biggi_52_GREEN_O.png","Biggi_52_GREEN_B.png","Biggi_52_GREEN_W.png","Biggi_52_GREEN_BR.png","Biggi_52_GREEN_BL.png",
    "Biggi_53_GREEN_O.png","Biggi_53_GREEN_B.png","Biggi_53_GREEN_W.png","Biggi_53_GREEN_BR.png","Biggi_53_GREEN_BL.png",
    "Biggi_54_GREEN_O.png","Biggi_54_GREEN_B.png","Biggi_54_GREEN_W.png","Biggi_54_GREEN_BR.png","Biggi_54_GREEN_BL.png",
    "Biggi_55_GREEN_O.png","Biggi_55_GREEN_B.png","Biggi_55_GREEN_W.png","Biggi_55_GREEN_BR.png","Biggi_55_GREEN_BL.png",
    "Biggi_56_GREEN_O.png","Biggi_56_GREEN_B.png","Biggi_56_GREEN_W.png","Biggi_56_GREEN_BR.png","Biggi_56_GREEN_BL.png",
    "Biggi_57_GREEN_O.png","Biggi_57_GREEN_B.png","Biggi_57_GREEN_W.png","Biggi_57_GREEN_BR.png","Biggi_57_GREEN_BL.png",
    "Biggi_58_GREEN_O.png","Biggi_58_GREEN_B.png","Biggi_58_GREEN_W.png","Biggi_58_GREEN_BR.png","Biggi_58_GREEN_BL.png",
    "Biggi_59_GREEN_O.png","Biggi_59_GREEN_B.png","Biggi_59_GREEN_W.png","Biggi_59_GREEN_BR.png","Biggi_59_GREEN_BL.png",
    "Biggi_60_GREEN_O.png","Biggi_60_GREEN_B.png","Biggi_60_GREEN_W.png","Biggi_60_GREEN_BR.png","Biggi_60_GREEN_BL.png"
  ],
  VIOLET: [
    "Biggi_61_VIOLET_O.png","Biggi_61_VIOLET_B.png","Biggi_61_VIOLET_W.png","Biggi_61_VIOLET_BR.png",
    "Biggi_62_VIOLET_O.png","Biggi_62_VIOLET_B.png","Biggi_62_VIOLET_W.png","Biggi_62_VIOLET_BR.png",
    "Biggi_63_VIOLET_O.png","Biggi_63_VIOLET_B.png","Biggi_63_VIOLET_W.png","Biggi_63_VIOLET_BR.png",
    "Biggi_64_VIOLET_O.png","Biggi_64_VIOLET_B.png","Biggi_64_VIOLET_W.png","Biggi_64_VIOLET_BR.png",
    "Biggi_65_VIOLET_O.png","Biggi_65_VIOLET_B.png","Biggi_65_VIOLET_W.png","Biggi_65_VIOLET_BR.png",
    "Biggi_66_VIOLET_O.png","Biggi_66_VIOLET_B.png","Biggi_66_VIOLET_W.png","Biggi_66_VIOLET_BR.png",
    "Biggi_67_VIOLET_O.png","Biggi_67_VIOLET_B.png","Biggi_67_VIOLET_W.png","Biggi_67_VIOLET_BR.png",
    "Biggi_68_VIOLET_O.png","Biggi_68_VIOLET_B.png","Biggi_68_VIOLET_W.png","Biggi_68_VIOLET_BR.png",
    "Biggi_69_VIOLET_O.png","Biggi_69_VIOLET_B.png","Biggi_69_VIOLET_W.png","Biggi_69_VIOLET_BR.png",
    "Biggi_70_VIOLET_O.png","Biggi_70_VIOLET_B.png","Biggi_70_VIOLET_W.png","Biggi_70_VIOLET_BR.png"
  ],
  RED: [
    "Biggi_71_RED_O.png","Biggi_71_RED_B.png","Biggi_71_RED_W.png",
    "Biggi_72_RED_O.png","Biggi_72_RED_B.png","Biggi_72_RED_W.png",
    "Biggi_73_RED_O.png","Biggi_73_RED_B.png","Biggi_73_RED_W.png",
    "Biggi_74_RED_O.png","Biggi_74_RED_B.png","Biggi_74_RED_W.png",
    "Biggi_75_RED_O.png","Biggi_75_RED_B.png","Biggi_75_RED_W.png",
    "Biggi_76_RED_O.png","Biggi_76_RED_B.png","Biggi_76_RED_W.png",
    "Biggi_77_RED_O.png","Biggi_77_RED_B.png","Biggi_77_RED_W.png",
    "Biggi_78_RED_O.png","Biggi_78_RED_B.png","Biggi_78_RED_W.png",
    "Biggi_79_RED_O.png","Biggi_79_RED_B.png","Biggi_79_RED_W.png",
    "Biggi_80_RED_O.png","Biggi_80_RED_B.png","Biggi_80_RED_W.png"
  ],
  PINK: [
    "Biggi_81_PINK_O.png","Biggi_81_PINK_B.png",
    "Biggi_82_PINK_O.png","Biggi_82_PINK_B.png",
    "Biggi_83_PINK_O.png","Biggi_83_PINK_B.png",
    "Biggi_84_PINK_O.png","Biggi_84_PINK_B.png",
    "Biggi_85_PINK_O.png","Biggi_85_PINK_B.png",
    "Biggi_86_PINK_O.png","Biggi_86_PINK_B.png",
    "Biggi_87_PINK_O.png","Biggi_87_PINK_B.png",
    "Biggi_88_PINK_O.png","Biggi_88_PINK_B.png",
    "Biggi_89_PINK_O.png","Biggi_89_PINK_B.png",
    "Biggi_90_PINK_O.png","Biggi_90_PINK_B.png"
  ],
  
  RAINBOW: [
    "Biggi_91_RAINBOW_O.png",
    "Biggi_92_RAINBOW_O.png",
    "Biggi_93_RAINBOW_O.png",
    "Biggi_94_RAINBOW_O.png",
    "Biggi_95_RAINBOW_O.png",
    "Biggi_96_RAINBOW_O.png",
    "Biggi_97_RAINBOW_O.png",
    "Biggi_98_RAINBOW_O.png",
    "Biggi_99_RAINBOW_O.png",
    "Biggi_100_RAINBOW_O.png"
  ],
};
export default BLOCK_IMAGES;
