import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, FlatList, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface RegionDoc {
  id: string;
  name: string;
  sigungu: string[];
}

export default function Step3Region({ formData, updateForm, nextStep, prevStep }: {
  formData: any;
  updateForm: (data: Partial<any>) => void;
  nextStep: () => void;
  prevStep: () => void;
}) {
  const [regions, setRegions] = useState<RegionDoc[]>([]);
  const [sido, setSido] = useState(formData.province || '');
  const [sigungu, setSigungu] = useState(formData.city || '');
  const [sigunguList, setSigunguList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidoModal, setSidoModal] = useState(false);
  const [sigunguModal, setSigunguModal] = useState(false);

  useEffect(() => {
    const fetchRegions = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'regions'));
        const list: RegionDoc[] = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            name: d.name,
            sigungu: d.sigungu || [],
          });
        });
        setRegions(list);
      } catch (e) {
        setError('지역 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchRegions();
  }, []);

  useEffect(() => {
    if (sido) {
      const region = regions.find(r => r.name === sido);
      setSigunguList(region ? region.sigungu : []);
      setSigungu('');
    } else {
      setSigunguList([]);
      setSigungu('');
    }
  }, [sido, regions]);

  const handleNext = () => {
    if (!sido || !sigungu) {
      setError('시/도와 시군구를 모두 선택하세요.');
      return;
    }
    setError(null);
    // regions 구조로 저장하도록 수정
    updateForm({ 
      regions: {
        sido: sido,
        sigungu: sigungu,
        address: ''
      }
    });
    nextStep();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={64}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Text style={styles.stepIndicator}>3 / 5</Text>
          <Text style={styles.title}>지역 정보</Text>
          <Text style={styles.subtitle}>시/도와 시군구를 선택해 주세요.</Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 32 }} />
          ) : (
            <>
              <Text style={styles.label}>시/도</Text>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setSidoModal(true)}>
                <Text style={sido ? styles.selectedText : styles.placeholderText}>
                  {sido || '시/도 선택'}
                </Text>
              </TouchableOpacity>
              <Modal visible={sidoModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <FlatList
                      data={regions}
                      keyExtractor={item => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.modalItem}
                          onPress={() => {
                            setSido(item.name);
                            setSidoModal(false);
                          }}
                        >
                          <Text style={styles.modalItemText}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    <TouchableOpacity onPress={() => setSidoModal(false)} style={styles.modalCloseBtn}>
                      <Text style={styles.modalCloseText}>닫기</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              <Text style={styles.label}>시/군/구</Text>
              <TouchableOpacity
                style={[styles.selectBtn, !sido && styles.disabledBtn]}
                onPress={() => sido && setSigunguModal(true)}
                disabled={!sido}
              >
                <Text style={sigungu ? styles.selectedText : styles.placeholderText}>
                  {sigungu || '시/군/구 선택'}
                </Text>
              </TouchableOpacity>
              <Modal visible={sigunguModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <FlatList
                      data={sigunguList}
                      keyExtractor={item => item}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.modalItem}
                          onPress={() => {
                            setSigungu(item);
                            setSigunguModal(false);
                          }}
                        >
                          <Text style={styles.modalItemText}>{item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    <TouchableOpacity onPress={() => setSigunguModal(false)} style={styles.modalCloseBtn}>
                      <Text style={styles.modalCloseText}>닫기</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            </>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.navButton} onPress={prevStep}>
              <Text style={styles.navButtonText}>이전</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleNext}>
              <Text style={styles.buttonText}>다음</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  stepIndicator: {
    fontSize: 15,
    color: '#64748b',
    alignSelf: 'flex-start',
    marginBottom: 4,
    marginLeft: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  selectBtn: {
    width: 300,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  disabledBtn: {
    backgroundColor: '#f3f4f6',
  },
  placeholderText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  selectedText: {
    color: '#111827',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: 320,
    maxHeight: 400,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  modalItemText: {
    fontSize: 16,
    color: '#111827',
  },
  modalCloseBtn: {
    marginTop: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#2563eb',
    fontWeight: 'bold',
    fontSize: 15,
  },
  topNavRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  navButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    height: 48,
  },
  navButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    height: 48,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: '#dc2626',
    marginBottom: 8,
    fontSize: 14,
  },
}); 