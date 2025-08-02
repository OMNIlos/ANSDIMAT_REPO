import React from 'react';
import { View, StyleSheet } from 'react-native';
import Vector4 from './Vector4';

export default function Vector4Example() {
  return (
    <View style={styles.container}>
      {/* Базовое использование */}
      <Vector4 />
      
      {/* С кастомным размером */}
      <Vector4 width={100} height={35} />
      
      {/* С кастомным цветом */}
      <Vector4 color="#26B7FF" />
      
      {/* С кастомной толщиной линии */}
      <Vector4 strokeWidth={3} />
      
      {/* С кастомными стилями */}
      <Vector4 
        width={80} 
        height={25} 
        color="#FF6B6B"
        style={{ marginVertical: 10 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
}); 