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
type Cat = { name: string; color: string };

export default function MultiStorageScreen() {
  // ---------------- DOG STATE ----------------
  const [dogName, setDogName] = useState('');
  const [dogType, setDogType] = useState('');
  const [dog, setDog] = useState<Dog | null>(null);
  const [dogStorage, setDogStorage] = useState<StorageInstance<Dog> | null>(
    null,
  );

  // ---------------- CAT STATE ----------------
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('');
  const [cat, setCat] = useState<Cat | null>(null);
  const [catStorage, setCatStorage] = useState<StorageInstance<Cat> | null>(
    null,
  );

  // ---------------- DOG STORAGE ----------------
  const configureDogStorage = async () => {
    console.log('[DogStorage] Configuring storage...');
    const dogStore = await storage<Dog>({
      type: 'memory',
      keyAlias: 'dogKeyAlias',
      cacheStrategy: 'no_cache',
    });
    
    setDogStorage(dogStore);
    console.log('[DogStorage] Storage configured ✅', dogStore.id);
  };

  const saveDog = async () => {
    if (!dogName || !dogType) return;
    const newDog = { name: dogName, type: dogType };
    await dogStorage?.save(newDog);
    setDogName('');
    setDogType('');
    console.log('[DogStorage] Dog saved:', newDog);
  };

  const getDog = async () => {
    const storedDog = await dogStorage?.get();
    setDog(storedDog ?? null);
  };

  const deleteDog = async () => {
    await dogStorage?.remove();
    setDog(null);
  };

  // ---------------- CAT STORAGE ----------------
  const configureCatStorage = async () => {
    console.log('[CatStorage] Configuring storage...');
    const catStore = await storage<Cat>({
      type: 'memory',
      keyAlias: 'catKeyAlias',
      cacheStrategy: 'no_cache',
    });
    setCatStorage(catStore);
    console.log(`[CatStorage] Storage configured ✅ with id`);
  };

  const saveCat = async () => {
    if (!catName || !catColor) return;
    const newCat = { name: catName, color: catColor };
    await catStorage?.save(newCat);
    setCatName('');
    setCatColor('');
    console.log('[CatStorage] Cat saved:', newCat);
  };

  const getCat = async () => {
    const storedCat = await catStorage?.get();
    setCat(storedCat ?? null);
  };

  const deleteCat = async () => {
    await catStorage?.remove();
    setCat(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* ---------------- DOG SECTION ---------------- */}
      <Text style={styles.title}>🐶 Dog Storage</Text>

      <View style={styles.section}>
        <Button title="Configure Dog Storage" onPress={configureDogStorage} />
      </View>

      <View style={styles.section}>
        <TextInput
          style={styles.input}
          placeholder="Dog Name"
          value={dogName}
          onChangeText={setDogName}
        />
        <TextInput
          style={styles.input}
          placeholder="Dog Type"
          value={dogType}
          onChangeText={setDogType}
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

      {/* ---------------- CAT SECTION ---------------- */}
      <Text style={[styles.title, { marginTop: 40 }]}>🐱 Cat Storage</Text>

      <View style={styles.section}>
        <Button title="Configure Cat Storage" onPress={configureCatStorage} />
      </View>

      <View style={styles.section}>
        <TextInput
          style={styles.input}
          placeholder="Cat Name"
          value={catName}
          onChangeText={setCatName}
        />
        <TextInput
          style={styles.input}
          placeholder="Cat Color"
          value={catColor}
          onChangeText={setCatColor}
        />
      </View>

      <View style={styles.buttonRow}>
        <View style={styles.button}>
          <Button title="Save Cat" onPress={saveCat} />
        </View>
        <View style={styles.button}>
          <Button title="Get Cat" onPress={getCat} />
        </View>
        <View style={styles.button}>
          <Button title="Delete Cat" onPress={deleteCat} />
        </View>
      </View>

      <Text style={styles.output}>
        {cat ? `Stored Cat: ${cat.name} (${cat.color})` : 'No cat stored'}
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
