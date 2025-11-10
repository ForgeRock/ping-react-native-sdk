import { storage, StorageInstance } from '@react-native-pingidentity/storage';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
} from 'react-native';

type Dog = { name: string; type: string };

export default function DogStorageScreen() {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [dog, setDog] = useState<Dog | null| undefined>(null);
  const [dogStorage, setDogStorage] = useState<StorageInstance<Dog> | null>(
    null,
  );

  const configureStorage = async () => {
    console.log('[DogStorage] Configuring storage...');
    setDogStorage(
      await storage<Dog>({
        type: 'memory',
        keyAlias: 'dogKeyAlias',
        cacheStrategy: 'no_cache',
      }),
    );
    console.log('[DogStorage] Storage configured ✅');
  };

  const saveDog = async () => {
    if (!name || !type) {
      console.warn('[DogStorage] Cannot save dog — missing name or type');
      return;
    }
    const newDog = { name, type };
    console.log('[DogStorage] Saving dog:', newDog);
    await dogStorage?.save(newDog);
    setName('');
    setType('');
    console.log('[DogStorage] Dog saved ✅');
  };

  const getDog = async () => {
    console.log('[DogStorage] Fetching dog...');
    const storedDog = await dogStorage?.get();
    console.log('[DogStorage] Retrieved:', storedDog);
    setDog(storedDog);
  };

  const deleteDog = async () => {
    console.log('[DogStorage] Deleting stored dog...');
    await dogStorage?.remove();
    setDog(null);
    console.log('[DogStorage] Dog deleted ✅');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🐶 Dog Storage</Text>

      <View style={styles.section}>
        <Button title="Configure Storage" onPress={configureStorage} />
      </View>

      <View style={styles.section}>
        <TextInput
          style={styles.input}
          placeholder="Enter Dog Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Enter Dog Type"
          value={type}
          onChangeText={setType}
        />
      </View>

      <View style={styles.buttonRow}>
        <View style={styles.button}>
          <Button title="Save Dog" onPress={saveDog} />
        </View>
        <View style={styles.button}>
          <Button title="Get Dog" onPress={getDog} />
        </View>
        <View style={styles.button}>
          <Button title="Delete Dog" onPress={deleteDog} />
        </View>
      </View>

      <Text style={styles.output}>
        {dog ? `Stored Dog: ${dog.name} (${dog.type})` : 'No dog stored'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    backgroundColor: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 15,
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
  output: {
    marginTop: 30,
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#333',
  },
});
