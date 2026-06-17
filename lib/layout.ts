import { Platform, useWindowDimensions } from 'react-native';

const PHONE_MAX = 480;
const TABLET_MAX = 720;

export function isWeb() {
  return Platform.OS === 'web';
}

export function useAppLayout() {
  const { width } = useWindowDimensions();
  const web = isWeb();

  let contentMaxWidth: number | undefined;
  if (web) {
    if (width >= 768) contentMaxWidth = TABLET_MAX;
    else contentMaxWidth = Math.min(width, PHONE_MAX);
  }

  return {
    isWeb: web,
    isTabletWeb: web && width >= 768,
    isPhoneWeb: web && width < 768,
    contentMaxWidth,
    windowWidth: width,
  };
}
