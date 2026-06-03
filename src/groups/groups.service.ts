import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Group } from './entities/group.entity';

@Injectable()
export class GroupsService {
  private groups: Group[] = [
    { id: 1, name: 'Wolves', description: 'Werewolf faction' },
    { id: 2, name: 'Villagers', description: 'Town faction' },
  ];
  private nextId = 3;

  findAll(): Group[] {
    return this.groups;
  }

  findOne(id: number): Group {
    const group = this.groups.find((g) => g.id === id);
    if (!group) {
      throw new NotFoundException(`Group #${id} not found`);
    }
    return group;
  }

  create(dto: CreateGroupDto): Group {
    const group: Group = {
      id: this.nextId++,
      name: dto.name,
      description: dto.description,
    };
    this.groups.push(group);
    return group;
  }

  update(id: number, dto: UpdateGroupDto): Group {
    const group = this.findOne(id);
    if (dto.name !== undefined) {
      group.name = dto.name;
    }
    if (dto.description !== undefined) {
      group.description = dto.description;
    }
    return group;
  }

  remove(id: number): Group {
    const index = this.groups.findIndex((g) => g.id === id);
    if (index === -1) {
      throw new NotFoundException(`Group #${id} not found`);
    }
    const [removed] = this.groups.splice(index, 1);
    return removed;
  }
}
