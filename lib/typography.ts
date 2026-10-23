import { TextStyle } from 'react-native';

export const fonts = {
  body: 'Raleway_400Regular',
  bodySemi: 'Raleway_600SemiBold',
  title: 'Outfit_700Bold',
  titleExtra: 'Outfit_800ExtraBold',
};

export const textStyles = {
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 } satisfies TextStyle,
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 } satisfies TextStyle,
  bodySemi: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 22 } satisfies TextStyle,
  h3: { fontFamily: fonts.title, fontSize: 17, lineHeight: 24 } satisfies TextStyle,
  h2: { fontFamily: fonts.title, fontSize: 22, lineHeight: 28 } satisfies TextStyle,
  h1: { fontFamily: fonts.titleExtra, fontSize: 28, lineHeight: 34 } satisfies TextStyle,
};
