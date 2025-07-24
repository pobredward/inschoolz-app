import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchUsers, checkReferralExists } from '../lib/users';

interface ReferralUser {
  uid: string;
  userName: string;
  realName: string;
}

interface ReferralSearchProps {
  value?: string;
  onSelect: (user: ReferralUser | null) => void;
  placeholder?: string;
  style?: any;
}

export const ReferralSearch: React.FC<ReferralSearchProps> = ({
  value = '',
  onSelect,
  placeholder = "추천인 아이디 검색",
  style
}) => {
  const [searchTerm, setSearchTerm] = useState(value);
  const [searchResults, setSearchResults] = useState<ReferralUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ReferralUser | null>(null);
  
  const debounceRef = useRef<any>(null);

  // 디바운싱된 검색
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchTerm.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const results = await searchUsers(searchTerm);
          setSearchResults(results);
          setIsOpen(true);
        } catch (error) {
          console.error('검색 오류:', error);
          setSearchResults([]);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setIsOpen(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm]);

  const handleInputChange = (text: string) => {
    setSearchTerm(text);
    
    // 선택된 사용자가 있고 입력값이 변경되면 선택 해제
    if (selectedUser && text !== selectedUser.userName) {
      setSelectedUser(null);
      onSelect(null);
    }
  };

  const handleUserSelect = (user: ReferralUser) => {
    setSelectedUser(user);
    setSearchTerm(user.userName);
    setIsOpen(false);
    onSelect(user);
  };

  const handleClear = () => {
    setSearchTerm('');
    setSelectedUser(null);
    setSearchResults([]);
    setIsOpen(false);
    onSelect(null);
  };

  const maskRealName = (realName: string): string => {
    if (realName.length <= 1) return realName;
    if (realName.length === 2) return realName.charAt(0) + '*';
    return realName.charAt(0) + '*'.repeat(realName.length - 2) + realName.charAt(realName.length - 1);
  };

  const renderSearchResult = (item: ReferralUser) => (
    <TouchableOpacity
      key={item.uid}
      style={styles.resultItem}
      onPress={() => handleUserSelect(item)}
    >
      <View style={styles.resultItemContent}>
        <Ionicons name="person-outline" size={16} color="#666" />
        <View style={styles.resultText}>
          <Text style={styles.userName}>{item.userName}</Text>
          <Text style={styles.realName}>{maskRealName(item.realName)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            selectedUser && styles.inputSelected
          ]}
          value={searchTerm}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          placeholderTextColor="#999"
        />
        
        <View style={styles.inputIcons}>
          {isLoading && (
            <ActivityIndicator size="small" color="#007AFF" style={styles.icon} />
          )}
          
          {selectedUser && (
            <TouchableOpacity onPress={handleClear} style={styles.icon}>
              <Ionicons name="close" size={16} color="#666" />
            </TouchableOpacity>
          )}
          
          <Ionicons name="search" size={16} color="#999" style={styles.icon} />
        </View>
      </View>

      {/* 선택된 사용자 표시 */}
      {selectedUser && (
        <View style={styles.selectedUser}>
          <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
          <Text style={styles.selectedUserText}>
            선택됨: <Text style={styles.selectedUserName}>{selectedUser.userName}</Text> ({maskRealName(selectedUser.realName)})
          </Text>
        </View>
      )}

      {/* 검색 결과 목록 */}
      {isOpen && (
        <View style={styles.resultsContainer}>
          {searchResults.length > 0 ? (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsHeaderText}>
                  검색 결과 ({searchResults.length}개)
                </Text>
              </View>
              <ScrollView
                style={styles.resultsList}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {searchResults.map(renderSearchResult)}
              </ScrollView>
            </>
          ) : searchTerm.trim().length >= 2 && !isLoading ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>검색 결과가 없습니다</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingRight: 60,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  inputSelected: {
    borderColor: '#22C55E',
  },
  inputIcons: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -12 }],
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginLeft: 4,
  },
  selectedUser: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedUserText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#15803D',
  },
  selectedUserName: {
    fontWeight: 'bold',
  },
  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    maxHeight: 240,
    zIndex: 1000,
  },
  resultsHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  resultsHeaderText: {
    fontSize: 12,
    color: '#6B7280',
  },
  resultsList: {
    maxHeight: 200,
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  resultItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultText: {
    marginLeft: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  realName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  noResults: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#6B7280',
  },
}); 