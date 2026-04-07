import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image } from 'react-native';
import { getHistory, ScanResult } from '../database/sqlite';
import { useIsFocused } from '@react-navigation/native';

export default function History() {
  const [data, setData] = useState<ScanResult[]>([]);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      getHistory().then(setData);
    }
  }, [isFocused]);

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id!.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.image_uri }} style={styles.img} />
            <View style={styles.info}>
              <Text style={styles.title}>{item.disease_name}</Text>
              <Text style={styles.date}>{new Date(item.timestamp).toLocaleDateString()}</Text>
              <Text style={{ color: item.is_synced ? '#4CAF50' : '#FF9800', fontWeight: 'bold' }}>
                {item.is_synced ? "✓ Synced" : "○ Local Log"}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No scans found. Start by scanning a crop!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0', padding: 10 },
  card: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 10, marginBottom: 10, overflow: 'hidden', elevation: 3 },
  img: { width: 80, height: 80 },
  info: { padding: 10, flex: 1 },
  title: { fontSize: 16, fontWeight: 'bold' },
  date: { color: '#666', fontSize: 12, marginVertical: 2 },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' }
});