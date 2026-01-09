import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { commonStyles } from '../src/styles/common';
import {
  getAnimalStorages,
  Dog,
  Cat,
  configureDogStorage,
  configureCatStorage,
} from '../src/animalStorages';

export default function MultiStorageScreen() {
  const [dogStorage, setDogStorage] = useState(
    () => getAnimalStorages().dogStorage,
  );
  const [catStorage, setCatStorage] = useState(
    () => getAnimalStorages().catStorage,
  );

  const [dogName, setDogName] = useState('');
  const [dogType, setDogType] = useState('');
  const [dog, setDog] = useState<Dog | null>(null);
  const [dogDeleteSuccess, setDogDeleteSuccess] = useState('');

  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('');
  const [cat, setCat] = useState<Cat | null>(null);
  const [catDeleteSuccess, setCatDeleteSuccess] = useState('');

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      {/* DOG CARD */}
      <View style={commonStyles.card}>
        <Text style={commonStyles.journeySectionTitle}>🐶 Dog Storage</Text>

        {!dogStorage ? (
          <TouchableOpacity
            style={commonStyles.buttonPrimary}
            onPress={() => {
              setDogStorage(configureDogStorage());
            }}
          >
            <Text style={commonStyles.buttonText}>Configure Dog Storage</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Show storage id */}
            <Text style={commonStyles.textSmall}>
              Storage ID: {dogStorage.id}
            </Text>

            {/* Dog fields */}
            <Text style={commonStyles.inputLabel}>Name</Text>
            <TextInput
              style={commonStyles.input}
              value={dogName}
              onChangeText={setDogName}
              placeholder="Enter dog name"
            />

            <Text style={commonStyles.inputLabel}>Type</Text>
            <TextInput
              style={commonStyles.input}
              value={dogType}
              onChangeText={setDogType}
              placeholder="Enter dog type"
            />

            <TouchableOpacity
              style={commonStyles.buttonPrimary}
              onPress={async () => {
                await dogStorage.save({ name: dogName, type: dogType });
                setDogName('');
                setDogType('');
              }}
            >
              <Text style={commonStyles.buttonText}>Save Dog</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={async () => {
                setDog(await dogStorage.getItem());
                setDogDeleteSuccess('');
              }}
            >
              <Text style={commonStyles.buttonTextSecondary}>Get Dog</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={async () => {
                const success = await dogStorage.deleteItem();
                if (success) {
                  setDog(null);
                  setDogDeleteSuccess('Dog deleted successfully!');
                } else {
                  setDogDeleteSuccess('Failed to delete dog');
                }
              }}
            >
              <Text style={commonStyles.buttonTextSecondary}>Delete Dog</Text>
            </TouchableOpacity>

            <Text style={commonStyles.textSuccess}>
              {dog ? `Dog: ${dog.name} (${dog.type})` : 'No dog stored'}
            </Text>

            {dogDeleteSuccess ? (
              <Text style={commonStyles.textSuccess}>{dogDeleteSuccess}</Text>
            ) : null}
          </>
        )}
      </View>

      {/* CAT CARD */}
      <View style={commonStyles.card}>
        <Text style={commonStyles.journeySectionTitle}>🐱 Cat Storage</Text>

        {!catStorage ? (
          <TouchableOpacity
            style={commonStyles.buttonPrimary}
            onPress={() => {
              setCatStorage(configureCatStorage());
            }}
          >
            <Text style={commonStyles.buttonText}>Configure Cat Storage</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Show storage id */}
            <Text style={commonStyles.textSmall}>
              Storage ID: {catStorage.id}
            </Text>

            <Text style={commonStyles.inputLabel}>Name</Text>
            <TextInput
              style={commonStyles.input}
              value={catName}
              onChangeText={setCatName}
              placeholder="Enter cat name"
            />

            <Text style={commonStyles.inputLabel}>Color</Text>
            <TextInput
              style={commonStyles.input}
              value={catColor}
              onChangeText={setCatColor}
              placeholder="Enter cat color"
            />

            <TouchableOpacity
              style={commonStyles.buttonPrimary}
              onPress={async () => {
                await catStorage.save({ name: catName, color: catColor });
                setCatName('');
                setCatColor('');
              }}
            >
              <Text style={commonStyles.buttonText}>Save Cat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={async () => {
                setCat(await catStorage.getItem());
                setCatDeleteSuccess('');
              }}
            >
              <Text style={commonStyles.buttonTextSecondary}>Get Cat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={async () => {
                const success = await catStorage.deleteItem();
                if (success) {
                  setCat(null);
                  setCatDeleteSuccess('Cat deleted successfully!');
                } else {
                  setCatDeleteSuccess('Failed to delete cat');
                }
              }}
            >
              <Text style={commonStyles.buttonTextSecondary}>Delete Cat</Text>
            </TouchableOpacity>

            <Text style={commonStyles.textSuccess}>
              {cat ? `Cat: ${cat.name} (${cat.color})` : 'No cat stored'}
            </Text>

            {catDeleteSuccess ? (
              <Text style={commonStyles.textSuccess}>{catDeleteSuccess}</Text>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}