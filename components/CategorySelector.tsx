import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Board } from '../types';

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  order: number;
  isActive: boolean;
}

interface CategorySelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (category: Category) => void;
  categories: Category[];
  selectedCategory?: Category;
}

interface CategoryButtonProps {
  selectedCategory?: Category;
  onPress: () => void;
  boardName: string;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  visible,
  onClose,
  onSelect,
  categories,
  selectedCategory,
}) => {
  const handleSelectCategory = (category: Category) => {
    onSelect(category);
    onClose();
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedCategory?.id === item.id && styles.selectedItem,
      ]}
      onPress={() => handleSelectCategory(item)}
    >
      <View style={styles.categoryContent}>
        {item.icon && (
          <Text style={styles.categoryIcon}>{item.icon}</Text>
        )}
        <View style={styles.categoryText}>
          <Text style={styles.categoryName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.categoryDescription}>{item.description}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <SafeAreaView style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>게시글 카테고리를 선택해 주세요</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={categories.filter(cat => cat.isActive)}
              renderItem={renderCategoryItem}
              keyExtractor={(item) => item.id}
              style={styles.categoryList}
              showsVerticalScrollIndicator={false}
            />
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

export const CategoryButton: React.FC<CategoryButtonProps> = ({
  selectedCategory,
  onPress,
  boardName,
}) => {
  return (
    <TouchableOpacity style={styles.categoryButton} onPress={onPress}>
      <View style={styles.categoryButtonContent}>
        <Text style={styles.categoryButtonLabel}>카테고리</Text>
        <Text style={styles.categoryButtonValue}>
          {selectedCategory ? selectedCategory.name : `${boardName} 카테고리 선택`}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6b7280',
  },
  categoryList: {
    flex: 1,
    padding: 16,
  },
  categoryItem: {
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  selectedItem: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  categoryText: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  categoryButtonContent: {
    flex: 1,
  },
  categoryButtonLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  categoryButtonValue: {
    fontSize: 16,
    color: '#111827',
  },
  chevron: {
    fontSize: 20,
    color: '#6b7280',
  },
}); 