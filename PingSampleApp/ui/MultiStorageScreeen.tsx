import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { storage, StorageInstance } from '@react-native-pingidentity/storage';
import { commonStyles } from '../src/styles/common';

type Dog = { name: string; type: string };
type Cat = { name: string; color: string };

export default function MultiStorageScreen() {
  // ----- DOG -----
  const [dogName, setDogName] = useState('');
  const [dogType, setDogType] = useState('');
  const [dog, setDog] = useState<Dog | null>(null);
  const [dogStorage, setDogStorage] = useState<StorageInstance<Dog> | null>(null);

  // ----- CAT -----
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('');
  const [cat, setCat] = useState<Cat | null>(null);
  const [catStorage, setCatStorage] = useState<StorageInstance<Cat> | null>(null);

  // ----- DOG STORAGE -----
  const configureDogStorage = async () => {
    const dogStore = await storage<Dog>({
      type: 'memory',
      keyAlias: 'dogKeyAlias',
      cacheStrategy: 'no_cache',
    });
    setDogStorage(dogStore);
  };

  const saveDog = async () => {
    if (!dogName || !dogType) return;
    await dogStorage?.save({ name: dogName, type: dogType });
    setDogName('');
    setDogType('');
  };

  const getDog = async () => {
    const storedDog = await dogStorage?.get();
    setDog(storedDog ?? null);
  };

  const deleteDog = async () => {
    await dogStorage?.remove();
    setDog(null);
  };

  // ----- CAT STORAGE -----
  const configureCatStorage = async () => {
    const catStore = await storage<Cat>({
      type: 'memory',
      keyAlias: 'catKeyAlias',
      cacheStrategy: 'no_cache',
    });
    setCatStorage(catStore);
  };

  const saveCat = async () => {
    if (!catName || !catColor) return;
    await catStorage?.save({ name: catName, color: catColor });
    setCatName('');
    setCatColor('');
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
    <ScrollView contentContainerStyle={commonStyles.container}>

      {/* DOG CARD */}
      <View style={commonStyles.card}>
        <Text style={commonStyles.journeySectionTitle}>🐶 Dog Storage</Text>

        {!dogStorage ? (
          <TouchableOpacity style={commonStyles.buttonPrimary} onPress={configureDogStorage}>
            <Text style={commonStyles.buttonText}>Configure Dog Storage</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Dog Name */}
            <View style={{ marginBottom: 14 }}>
              <Text style={commonStyles.inputLabel}>Dog Name</Text>
              <TextInput
                style={commonStyles.input}
                value={dogName}
                onChangeText={setDogName}
                placeholder="Enter dog name"
              />
            </View>

            {/* Dog Type */}
            <View style={{ marginBottom: 14 }}>
              <Text style={commonStyles.inputLabel}>Dog Type</Text>
              <TextInput
                style={commonStyles.input}
                value={dogType}
                onChangeText={setDogType}
                placeholder="Enter dog type"
              />
            </View>

            <TouchableOpacity style={commonStyles.buttonPrimary} onPress={saveDog}>
              <Text style={commonStyles.buttonText}>Save Dog</Text>
            </TouchableOpacity>

            <TouchableOpacity style={commonStyles.buttonSecondary} onPress={getDog}>
              <Text style={commonStyles.buttonTextSecondary}>Get Dog</Text>
            </TouchableOpacity>

            <TouchableOpacity style={commonStyles.buttonDanger} onPress={deleteDog}>
              <Text style={commonStyles.buttonText}>Delete Dog</Text>
            </TouchableOpacity>

            <Text style={commonStyles.textSuccess}>
              {dog ? `Dog: ${dog.name} (${dog.type})` : 'No dog stored'}
            </Text>
          </>
        )}
      </View>

      {/* CAT CARD */}
      <View style={commonStyles.card}>
        <Text style={commonStyles.journeySectionTitle}>🐱 Cat Storage</Text>

        {!catStorage ? (
          <TouchableOpacity style={commonStyles.buttonPrimary} onPress={configureCatStorage}>
            <Text style={commonStyles.buttonText}>Configure Cat Storage</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Cat Name */}
            <View style={{ marginBottom: 14 }}>
              <Text style={commonStyles.inputLabel}>Cat Name</Text>
              <TextInput
                style={commonStyles.input}
                value={catName}
                onChangeText={setCatName}
                placeholder="Enter cat name"
              />
            </View>

            {/* Cat Color */}
            <View style={{ marginBottom: 14 }}>
              <Text style={commonStyles.inputLabel}>Cat Color</Text>
              <TextInput
                style={commonStyles.input}
                value={catColor}
                onChangeText={setCatColor}
                placeholder="Enter cat color"
              />
            </View>

            <TouchableOpacity style={commonStyles.buttonPrimary} onPress={saveCat}>
              <Text style={commonStyles.buttonText}>Save Cat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={commonStyles.buttonSecondary} onPress={getCat}>
              <Text style={commonStyles.buttonTextSecondary}>Get Cat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={commonStyles.buttonDanger} onPress={deleteCat}>
              <Text style={commonStyles.buttonText}>Delete Cat</Text>
            </TouchableOpacity>

            <Text style={commonStyles.textSuccess}>
              {cat ? `Cat: ${cat.name} (${cat.color})` : 'No cat stored'}
            </Text>
          </>
        )}
      </View>

    </ScrollView>
  );
}