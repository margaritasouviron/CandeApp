import { Redirect, useLocalSearchParams } from 'expo-router';

/** Bitácora unificada con Calendario */
export default function BitacoraRedirect() {
  const { saved, message } = useLocalSearchParams<{ saved?: string; message?: string }>();
  return (
    <Redirect
      href={{
        pathname: '/(tabs)/calendar',
        params: saved ? { saved, message } : undefined,
      }}
    />
  );
}
