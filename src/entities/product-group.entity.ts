import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductGroupItem } from './product-group-item.entity';

@Entity({ name: 'product_groups' })
export class ProductGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ProductGroupItem, (item) => item.group)
  items: ProductGroupItem[];
}
